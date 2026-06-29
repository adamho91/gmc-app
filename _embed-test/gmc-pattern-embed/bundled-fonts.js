/** Project-shipped fonts — installed into IndexedDB on startup via mergeBundledFonts(). */
window.GMC_BUNDLED_FONTS = [
  {
    key: "focal-light",
    id: "bundled-focal-light",
    name: "Focal Text Light",
    path: "fonts/FocalText-Light.otf",
  },
  {
    key: "focal-regular",
    id: "bundled-focal-regular",
    name: "Focal Text Regular",
    path: "fonts/FocalText-Regular.otf",
  },
  {
    key: "focal-medium",
    id: "bundled-focal-medium",
    name: "Focal Text Medium",
    path: "fonts/FocalText-Medium.otf",
  },
  {
    key: "focal-bold",
    id: "bundled-focal-bold",
    name: "Focal Text Bold",
    path: "fonts/FocalText-Bold.otf",
  },
  {
    key: "focal-extrabold",
    id: "bundled-focal-extrabold",
    name: "Focal Text Extrabold",
    path: "fonts/FocalText-Extrabold.otf",
  },
  {
    key: "focal-black",
    id: "bundled-focal-black",
    name: "Focal Text Black",
    path: "fonts/FocalText-Black.otf",
  },
];

/** Default typeface on first load and when no saved font preference exists. */
window.GMC_DEFAULT_FONT_ID = "bundled-focal-regular";
