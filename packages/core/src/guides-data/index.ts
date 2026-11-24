// One import per file. A new guide file needs one line here (guides-data.test.ts fails if it is missing).
import cancelNetflix from "./cancel--netflix.json";
import cancelSpotify from "./cancel--spotify.json";
import cancelYoutubePremium from "./cancel--youtube-premium.json";
import cancelDisneyPlus from "./cancel--disney-plus.json";
import cancelAmazonPrime from "./cancel--amazon-prime.json";
import cancelAdobeCreativeCloud from "./cancel--adobe-creative-cloud.json";
import cancelMicrosoft365 from "./cancel--microsoft-365.json";
import cancelChatgptPlus from "./cancel--chatgpt-plus.json";
import storeAppleAppStore from "./store--apple-app-store.json";
import storeGooglePlay from "./store--google-play.json";
import providerWise from "./provider--wise.json";

export const GUIDE_FILES: Record<string, unknown> = {
  "cancel--netflix.json": cancelNetflix,
  "cancel--spotify.json": cancelSpotify,
  "cancel--youtube-premium.json": cancelYoutubePremium,
  "cancel--disney-plus.json": cancelDisneyPlus,
  "cancel--amazon-prime.json": cancelAmazonPrime,
  "cancel--adobe-creative-cloud.json": cancelAdobeCreativeCloud,
  "cancel--microsoft-365.json": cancelMicrosoft365,
  "cancel--chatgpt-plus.json": cancelChatgptPlus,
  "store--apple-app-store.json": storeAppleAppStore,
  "store--google-play.json": storeGooglePlay,
  "provider--wise.json": providerWise,
};
