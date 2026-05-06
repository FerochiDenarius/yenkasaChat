import YenkasaFeedAd from "../feed/YenkasaFeedAd";

export default function YenkasaAdSenseSlot({ slotKey, onEmpty }) {
  return <YenkasaFeedAd slotKey={slotKey} variant="player" onEmpty={onEmpty} />;
}
