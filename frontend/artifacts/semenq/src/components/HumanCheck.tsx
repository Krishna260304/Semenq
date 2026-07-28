import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CaptchaChallenge = {
  left: number;
  right: number;
  operator: "+" | "-" | "*";
};

function randomInt(min: number, max: number): number {
  if (max <= min) return min;

  const range = max - min + 1;

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const limit = Math.floor(0x100000000 / range) * range;
    const buffer = new Uint32Array(1);

    while (true) {
      crypto.getRandomValues(buffer);
      if (buffer[0] < limit) {
        return min + (buffer[0] % range);
      }
    }
  }

  return Math.floor(Math.random() * range) + min;
}

export function createCaptchaChallenge(): CaptchaChallenge {
  const operatorPool: Array<CaptchaChallenge["operator"]> = ["+", "+", "-", "*"];
  const operator = operatorPool[randomInt(0, operatorPool.length - 1)];

  if (operator === "-") {
    const left = randomInt(5, 20);
    const right = randomInt(1, left - 1);
    return { left, right, operator };
  }

  if (operator === "*") {
    return {
      left: randomInt(1, 4),
      right: randomInt(1, 4),
      operator,
    };
  }

  return {
    left: randomInt(2, 25),
    right: randomInt(2, 25),
    operator,
  };
}

export function isCaptchaSolved(challenge: CaptchaChallenge, answer: string): boolean {
  const expected =
    challenge.operator === "+"
      ? challenge.left + challenge.right
      : challenge.operator === "-"
        ? challenge.left - challenge.right
        : challenge.left * challenge.right;

  return Number(answer.trim()) === expected;
}

type HumanCheckProps = {
  answer: string;
  challenge: CaptchaChallenge;
  error?: string;
  inputId: string;
  onAnswerChange: (value: string) => void;
  onRefresh: () => void;
};

export function HumanCheck({
  answer,
  challenge,
  error,
  inputId,
  onAnswerChange,
  onRefresh,
}: HumanCheckProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Captcha</Label>
      <div className="flex items-center gap-3 rounded-[16px] border border-input bg-muted/30 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Human check</p>
          <p className="text-sm font-semibold text-foreground">
            {challenge.left} {challenge.operator} {challenge.right} =
          </p>
        </div>
        <Input
          id={inputId}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Answer"
          value={answer}
          onChange={event => onAnswerChange(event.target.value)}
          className="h-10 w-24 rounded-[14px] text-center"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-[14px]"
          onClick={onRefresh}
          aria-label="Refresh captcha"
          title="Refresh captcha"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error ? <p id={`${inputId}-error`} className="text-destructive text-sm" role="alert">{error}</p> : null}
    </div>
  );
}
