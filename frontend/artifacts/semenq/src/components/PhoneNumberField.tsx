import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryCallingCodes, defaultDialCode } from "@/lib/country-calling-codes";

type PhoneNumberFieldProps = {
  label: string;
  dialCode: string;
  phoneNumber: string;
  onDialCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  disabled?: boolean;
  inputId?: string;
};

export function PhoneNumberField({
  label,
  dialCode,
  phoneNumber,
  onDialCodeChange,
  onPhoneNumberChange,
  disabled,
  inputId,
}: PhoneNumberFieldProps) {
  const triggerId = inputId ? `${inputId}-dial-code` : undefined;
  const phoneId = inputId ? `${inputId}-phone-number` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={phoneId}>{label}</Label>
      <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2">
        <Select value={dialCode || defaultDialCode} onValueChange={onDialCodeChange} disabled={disabled}>
          <SelectTrigger id={triggerId} className="h-12 rounded-[16px]">
            <SelectValue placeholder="+91" />
          </SelectTrigger>
          <SelectContent>
            {countryCallingCodes.map(({ country, dialCode: code }, index) => (
              <SelectItem key={`${country}-${code}-${index}`} value={code}>
                {country} (+{code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={phoneId}
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={e => onPhoneNumberChange(e.target.value)}
          className="h-12 rounded-[16px]"
          disabled={disabled}
          required
        />
      </div>
    </div>
  );
}
