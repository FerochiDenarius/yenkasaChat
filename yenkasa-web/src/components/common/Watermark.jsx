import { handleStaticImageError, staticImage } from "../../utils/images";

export default function Watermark() {
  return (
    <div className="yenkasa-watermark" aria-hidden="true">
      <img
        src={staticImage("logo.png")}
        alt=""
        onError={(event) => handleStaticImageError(event, "logo.png")}
      />
    </div>
  );
}
