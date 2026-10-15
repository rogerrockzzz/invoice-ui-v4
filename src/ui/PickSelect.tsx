import { Label, ListBox, Select } from "@heroui/react";

/* A labelled HeroUI Select over plain string options; `any` adds an empty choice (v3 "Any") */
export function PickSelect({ label, value, options, onChange, any, isDisabled, placeholder, className, testId }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; any?: string; isDisabled?: boolean;
  placeholder?: string; className?: string; testId?: string;
}) {
  const ANY = "__any";
  const items = any ? [ANY, ...options] : options;
  return (
    <Select className={className} value={value || (any ? ANY : null)} isDisabled={isDisabled} placeholder={placeholder} data-testid={testId}
      onChange={(v) => { if (typeof v === "string") onChange(v === ANY ? "" : v); }}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o === ANY ? any : o}>
              <Label>{o === ANY ? any : o}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
