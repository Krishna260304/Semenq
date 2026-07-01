
export const medicines = [
  { id: 1, name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "Antibiotics", manufacturer: "Cipla Ltd", composition: "Amoxicillin Trihydrate 500mg", dosage: "500mg", price: 98.5, mrp: 120, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop", requiresPrescription: true },
  { id: 2, name: "Paracetamol 650mg", genericName: "Paracetamol", category: "Analgesics", manufacturer: "Sun Pharma", composition: "Paracetamol 650mg", dosage: "650mg", price: 24.0, mrp: 30, imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=120&h=120&fit=crop", requiresPrescription: false },
  { id: 3, name: "Metformin 500mg", genericName: "Metformin HCl", category: "Antidiabetics", manufacturer: "USV Ltd", composition: "Metformin Hydrochloride 500mg", dosage: "500mg", price: 42.0, mrp: 55, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop", requiresPrescription: true },
  { id: 4, name: "Atorvastatin 20mg", genericName: "Atorvastatin", category: "Statins", manufacturer: "Lupin Ltd", composition: "Atorvastatin Calcium 20mg", dosage: "20mg", price: 85.0, mrp: 110, imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=120&h=120&fit=crop", requiresPrescription: true },
  { id: 5, name: "Pantoprazole 40mg", genericName: "Pantoprazole", category: "Proton Pump Inhibitors", manufacturer: "Dr. Reddy's", composition: "Pantoprazole Sodium 40mg", dosage: "40mg", price: 62.5, mrp: 80, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop", requiresPrescription: false },
  { id: 6, name: "Azithromycin 500mg", genericName: "Azithromycin", category: "Antibiotics", manufacturer: "Alkem Labs", composition: "Azithromycin Dihydrate 500mg", dosage: "500mg", price: 68.0, mrp: 85, imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=120&h=120&fit=crop", requiresPrescription: true },
  { id: 7, name: "Cetirizine 10mg", genericName: "Cetirizine HCl", category: "Antihistamines", manufacturer: "Mankind Pharma", composition: "Cetirizine Hydrochloride 10mg", dosage: "10mg", price: 18.5, mrp: 25, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop", requiresPrescription: false },
  { id: 8, name: "Losartan 50mg", genericName: "Losartan Potassium", category: "Antihypertensives", manufacturer: "Torrent Pharma", composition: "Losartan Potassium 50mg", dosage: "50mg", price: 78.0, mrp: 95, imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=120&h=120&fit=crop", requiresPrescription: true },
  { id: 9, name: "Omeprazole 20mg", genericName: "Omeprazole", category: "Proton Pump Inhibitors", manufacturer: "Zydus Cadila", composition: "Omeprazole 20mg", dosage: "20mg", price: 35.0, mrp: 45, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop", requiresPrescription: false },
  { id: 10, name: "Montelukast 10mg", genericName: "Montelukast Sodium", category: "Antiasthmatics", manufacturer: "Glenmark", composition: "Montelukast Sodium 10mg", dosage: "10mg", price: 115.0, mrp: 145, imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=120&h=120&fit=crop", requiresPrescription: true },
];

export const pharmacies = [
  { id: 1, name: "MedPlus Pharmacy - Andheri West", ownerName: "Rajesh Patel", address: "Shop 12, Lokhandwala Complex, Andheri West", city: "Mumbai", state: "Maharashtra", pincode: "400053", phone: "+91 98765 43210", email: "andheri@medplus.in", lat: 19.1334, lng: 72.8263, isVerified: true, rating: 4.8, reviewCount: 342, openTime: "08:00", closeTime: "22:00", offersCourier: true, licenseNumber: "MH-MUM-2019-08821", totalInventory: 2847 },
  { id: 2, name: "Apollo Pharmacy - Bandra", ownerName: "Sunita Sharma", address: "Ground Floor, Linking Road, Bandra West", city: "Mumbai", state: "Maharashtra", pincode: "400050", phone: "+91 87654 32109", email: "bandra@apollopharmacy.in", lat: 19.0596, lng: 72.8347, isVerified: true, rating: 4.7, reviewCount: 218, openTime: "07:00", closeTime: "23:00", offersCourier: true, licenseNumber: "MH-MUM-2018-07234", totalInventory: 3241 },
  { id: 3, name: "Jan Aushadhi Kendra - Dadar", ownerName: "Anil Kumar", address: "Shop 5, Dadar Railway Station Complex", city: "Mumbai", state: "Maharashtra", pincode: "400014", phone: "+91 76543 21098", email: "dadar@janaushadhi.gov.in", lat: 19.0178, lng: 72.8478, isVerified: true, rating: 4.5, reviewCount: 89, openTime: "09:00", closeTime: "20:00", offersCourier: false, licenseNumber: "MH-MUM-2020-11567", totalInventory: 1203 },
  { id: 4, name: "Wellness Forever - Pune", ownerName: "Priya Kulkarni", address: "FC Road, Near Fergusson College", city: "Pune", state: "Maharashtra", pincode: "411004", phone: "+91 65432 10987", email: "fcroad@wellnessforever.in", lat: 18.5204, lng: 73.8567, isVerified: true, rating: 4.6, reviewCount: 156, openTime: "09:00", closeTime: "21:00", offersCourier: true, licenseNumber: "MH-PUN-2019-05432", totalInventory: 2108 },
  { id: 5, name: "Netmeds Point - Bengaluru", ownerName: "Karthik Reddy", address: "100 Feet Road, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038", phone: "+91 54321 09876", email: "indiranagar@netmeds.com", lat: 12.9784, lng: 77.6408, isVerified: true, rating: 4.9, reviewCount: 423, openTime: "08:00", closeTime: "22:00", offersCourier: true, licenseNumber: "KA-BLR-2020-09871", totalInventory: 4102 },
];

export const sampleUser = {
  id: 1,
  name: "Arjun Mehta",
  email: "arjun.mehta@gmail.com",
  phone: "+91 98765 43210",
  role: "patient" as const,
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400053",
  address: "402, Shree Sai Apartments, Andheri West",
  avatarUrl: null,
  isVerified: true,
  createdAt: "2024-03-15T10:00:00Z",
};

export const samplePharmacyUser = {
  id: 2,
  name: "Sunita Sharma",
  email: "sunita@apollopharmacy.in",
  phone: "+91 87654 32109",
  role: "pharmacy" as const,
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
  address: "Ground Floor, Linking Road, Bandra West",
  avatarUrl: null,
  isVerified: true,
  createdAt: "2023-11-20T10:00:00Z",
};

export const notifications = [
  { id: 1, type: "success" as const, title: "Reservation Confirmed", message: "Your reservation for Metformin 500mg at Apollo Pharmacy Bandra is confirmed. Pick up by 6 PM today.", isRead: false, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), actionLabel: "View QR", actionUrl: "/patient/orders/1", relatedId: 1, relatedType: "reservation" },
  { id: 2, type: "aiInsight" as const, title: "AI Refill Reminder", message: "You're likely running low on Metformin 500mg based on your prescription history. Reserve now before stock runs out nearby.", isRead: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), actionLabel: "Search Medicines", actionUrl: "/patient/search", relatedId: null, relatedType: null },
  { id: 3, type: "warning" as const, title: "Reservation Expiring Soon", message: "Your reservation for Atorvastatin 20mg at MedPlus Andheri expires in 2 hours. Complete payment to secure it.", isRead: false, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), actionLabel: "Pay Now", actionUrl: "/patient/orders/2", relatedId: 2, relatedType: "reservation" },
  { id: 4, type: "info" as const, title: "Order Dispatched", message: "Your courier order of Amoxicillin 500mg has been dispatched from Netmeds Point Bengaluru. Expected delivery: Tomorrow by 7 PM.", isRead: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), actionLabel: "Track Order", actionUrl: "/patient/orders/3", relatedId: 3, relatedType: "order" },
];
