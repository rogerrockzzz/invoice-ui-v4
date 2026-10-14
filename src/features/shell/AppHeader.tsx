import { Avatar, Button, Dropdown, Label, ListBox, Select } from "@heroui/react";
import { Moon, Plus, Settings, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BRANCHES } from "../../domain/constants";
import { useWorld } from "../../store/world";
import { useUi } from "../../store/ui";
import { notify } from "../../store/toasts";

/* v3 <header> (body markup + render() lines 3441–3448) */
export function AppHeader() {
  const { t } = useTranslation();
  const branch = useWorld((s) => s.settings.branch);
  const setBranch = useWorld((s) => s.setBranch);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  return (
    <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-5 py-2">
      <div className="flex size-7 items-center justify-center rounded-md bg-vida-red text-white" aria-hidden>
        <Plus className="size-4" strokeWidth={3} />
      </div>
      <div className="leading-tight">
        <b className="block text-xs text-vida-navy">{t("app.group")}</b>
        <span className="text-[9px] uppercase tracking-wider text-muted">{t("app.groupSub")}</span>
      </div>
      <div className="ms-1 text-lg font-extrabold text-vida-red">
        {t("app.vida")}<sup className="text-[9px]">®</sup>
      </div>
      <div className="flex-1" />

      <Select
        aria-label={t("app.hospital")}
        className="w-56"
        value={branch}
        onChange={(v) => {
          if (typeof v !== "string" || v === branch) return;
          setBranch(v);
          notify("", t("app.hospitalChanged"), t("app.nowWorkingAt", { branch: v }));
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {BRANCHES.map((b) => (
              <ListBox.Item key={b} id={b} textValue={b}>
                <Label>{b}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Dropdown>
        <Button isIconOnly variant="ghost" aria-label={t("app.settings")}>
          <Settings className="size-4" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label={t("app.settings")} onAction={(key) => setTheme(key === "dark" ? "dark" : "light")}>
            <Dropdown.Item id="light" textValue={t("app.themeLight")}>
              <Sun className="size-4" />
              <Label>{t("app.themeLight")}</Label>
              {theme === "light" && <Dropdown.ItemIndicator />}
            </Dropdown.Item>
            <Dropdown.Item id="dark" textValue={t("app.themeDark")}>
              <Moon className="size-4" />
              <Label>{t("app.themeDark")}</Label>
              {theme === "dark" && <Dropdown.ItemIndicator />}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Avatar size="sm" color="accent" variant="soft">
          <Avatar.Fallback>SS</Avatar.Fallback>
        </Avatar>
        <div className="leading-tight">
          <b className="block text-xs text-vida-navy">{t("app.user")}</b>
          {t("app.role")}
        </div>
      </div>
    </header>
  );
}
