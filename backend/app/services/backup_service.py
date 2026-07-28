import asyncio
import os
import pandas as pd
from pymongo import UpdateOne
from app.core.database.connection import get_database
from app.models.medicine import Medicine, DosageForm, MedicineStatus
from app.core.logging.logger import get_logger

logger = get_logger(__name__)

def extract_dosage_form(name, med_type, pack_size_label):
    name = str(name).lower()
    med_type = str(med_type).lower()
    pack_size = str(pack_size_label).lower()
    
    combined = f"{name} {med_type} {pack_size}"
    
    if "tablet" in combined or "tab" in combined:
        return DosageForm.TABLET.value
    if "capsule" in combined or "cap" in combined:
        return DosageForm.CAPSULE.value
    if "syrup" in combined:
        return DosageForm.SYRUP.value
    if "injection" in combined or "inj" in combined:
        return DosageForm.INJECTION.value
    if "cream" in combined:
        return DosageForm.CREAM.value
    if "ointment" in combined:
        return DosageForm.OINTMENT.value
    if "drops" in combined or "drop" in combined:
        return DosageForm.DROPS.value
    if "inhaler" in combined:
        return DosageForm.INHALER.value
    if "patch" in combined:
        return DosageForm.PATCH.value
    if "suppository" in combined:
        return DosageForm.SUPPOSITORY.value
    if "gel" in combined:
        return DosageForm.GEL.value
    if "lotion" in combined:
        return DosageForm.LOTION.value
    if "powder" in combined:
        return DosageForm.POWDER.value
    if "suspension" in combined:
        return DosageForm.SUSPENSION.value
    
    return DosageForm.OTHER.value

async def restore_medicines_from_backup():
    logger.info("Checking if medicine database needs restoration from backup...")
    try:
        count = await Medicine.find_all().count()
        if count > 0:
            logger.info(f"Database has {count} medicines. Restoration not needed.")
            return

        logger.info("Medicine database is empty! Starting restoration from backup CSV...")

        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "medicines_dataset.csv")
        csv_path = os.path.abspath(csv_path)
        
        if not os.path.exists(csv_path):
            logger.error(f"Backup CSV not found at {csv_path}. Cannot restore.")
            return

        logger.info(f"Reading dataset from {csv_path}...")
        df = pd.read_csv(csv_path)
        
        db = await get_database()
        collection = db["medicines"]

        logger.info(f"Found {len(df)} records in CSV. Processing...")
        
        batch_size = 5000
        operations = []
        processed_count = 0

        for index, row in df.iterrows():
            try:
                name = str(row.get('name', '')).strip()
                if not name or name == 'nan':
                    continue

                price_str = str(row.get('price(₹)', '0'))
                try:
                    clean_price = price_str.replace('₹', '').replace(',', '').strip()
                    average_price = float(clean_price) if clean_price and clean_price != 'nan' else 0.0
                except ValueError:
                    average_price = 0.0

                is_discontinued = str(row.get('Is_discontinued', 'FALSE')).upper() == 'TRUE'
                status = MedicineStatus.DISCONTINUED.value if is_discontinued else MedicineStatus.ACTIVE.value
                
                manufacturer = str(row.get('manufacturer_name', '')).strip()
                if manufacturer == 'nan':
                    manufacturer = 'Unknown'

                pack_size_label = str(row.get('pack_size_label', '')).strip()
                if pack_size_label == 'nan':
                    pack_size_label = ''

                comp1 = str(row.get('short_composition1', '')).strip()
                comp2 = str(row.get('short_composition2', '')).strip()
                
                comp_list = []
                if comp1 and comp1 != 'nan':
                    comp_list.append(comp1)
                if comp2 and comp2 != 'nan':
                    comp_list.append(comp2)
                    
                composition = " + ".join(comp_list)
                if not composition:
                    composition = "Unknown"
                    
                generic_name = composition
                
                dosage_form = extract_dosage_form(name, row.get('type', ''), pack_size_label)
                
                search_keywords = [name.lower()]
                if composition != "Unknown":
                    search_keywords.extend([c.strip().lower() for c in composition.split('+')])

                update_doc = {
                    "$set": {
                        "name": name,
                        "generic_name": generic_name,
                        "composition": composition,
                        "strength": pack_size_label,
                        "dosage_form": dosage_form,
                        "manufacturer": manufacturer,
                        "status": status,
                        "average_price": average_price,
                        "search_keywords": list(set(search_keywords)),
                        "country": "India",
                        "prescription_required": False,
                        "scheduled_drug": False,
                        "review_count": 0,
                        "average_rating": 0.0,
                        "image_urls": [],
                        "description": "",
                        "usage_instructions": "",
                        "storage_instructions": "",
                        "side_effects": "",
                        "contraindications": "",
                        "warnings": "",
                        "drug_interactions": "",
                    },
                    "$setOnInsert": {
                        "_class_id": "Medicine"
                    }
                }
                
                operations.append(
                    UpdateOne({"name": name}, update_doc, upsert=True)
                )

                processed_count += 1

                if len(operations) >= batch_size:
                    await collection.bulk_write(operations, ordered=False)
                    logger.info(f"Processed and bulk wrote {processed_count} records so far...")
                    operations = []
                    await asyncio.sleep(0)
                    
            except Exception as e:
                logger.error(f"Error processing row {index} ({name}): {e}")

        if operations:
            await collection.bulk_write(operations, ordered=False)
            logger.info(f"Processed and bulk wrote {processed_count} records so far...")

        logger.info(f"Finished restoration! Total processed: {processed_count}")

    except Exception as e:
        logger.error(f"Failed to restore medicines from backup: {e}")
