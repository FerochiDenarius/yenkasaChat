import { CHAT_BACKGROUND_PRESETS } from "../../utils/chat";

export default function ChatBackgroundPicker({
  open,
  activeBackground,
  onSelectPreset,
  onSelectCustomBackground,
}) {
  if (!open) return null;

  return (
    <section className="chatroom-background-picker">
      <strong>Chat background</strong>
      <div>
        {CHAT_BACKGROUND_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`chatroom-bg-swatch chatroom-bg-swatch--${preset.key}${
              activeBackground === preset.key ? " is-active" : ""
            }`}
            onClick={() => onSelectPreset(preset.key)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`chatroom-bg-swatch chatroom-bg-swatch--custom${
            activeBackground === "custom" ? " is-active" : ""
          }`}
          onClick={onSelectCustomBackground}
        >
          Custom
        </button>
      </div>
    </section>
  );
}
