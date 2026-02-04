import { NextResponse } from "next/server";
import { getDb, resorts } from "@/db";
import { eq, isNull } from "drizzle-orm";

// Mapping of resort slugs to skiresort.info IDs
// This fills in any missing skiresortinfoId values
const slugToSkiResortInfoId: Record<string, string> = {
  // Colorado
  "vail": "vail",
  "breckenridge": "breckenridge",
  "aspen-mountain": "aspen-mountain",
  "aspen-highlands": "aspen-highlands",
  "snowmass": "snowmass",
  "buttermilk": "buttermilk",
  "beaver-creek": "beaver-creek",
  "keystone": "keystone",
  "copper-mountain": "copper-mountain",
  "winter-park": "winter-park-resort",
  "steamboat": "steamboat",
  "telluride": "telluride",
  "crested-butte": "crested-butte-mountain-resort",
  "arapahoe-basin": "arapahoe-basin",
  "loveland": "loveland",
  "eldora": "eldora-mountain-resort",
  "monarch-mountain": "monarch-mountain",
  "purgatory": "purgatory-resort",
  "wolf-creek": "wolf-creek",
  "ski-cooper": "ski-cooper",
  "powderhorn": "powderhorn",
  "sunlight-mountain": "sunlight-mountain-resort",
  "ski-granby-ranch": "granby-ranch",
  "echo-mountain": "echo-mountain",
  "hesperus": "hesperus-ski-area",
  "kendall-mountain": "kendall-mountain",
  "howelsen-hill": "howelsen-hill",
  "chapman-hill": "chapman-hill",
  "cranor-hill": "cranor-hill",
  "lake-city": "lake-city-ski-hill",
  "silverton-mountain": "silverton-mountain",

  // Utah
  "park-city": "park-city",
  "deer-valley": "deer-valley",
  "snowbird": "snowbird",
  "alta": "alta",
  "brighton": "brighton",
  "solitude": "solitude",
  "snowbasin": "snowbasin",
  "powder-mountain": "powder-mountain",
  "brian-head": "brian-head-resort",
  "sundance": "sundance-resort",
  "nordic-valley": "nordic-valley",
  "cherry-peak": "cherry-peak-resort",
  "beaver-mountain": "beaver-mountain",
  "eagle-point": "eagle-point-resort",
  "woodward-park-city": "woodward-park-city",

  // California
  "mammoth-mountain": "mammoth-mountain",
  "palisades-tahoe": "palisades-tahoe",
  "heavenly": "heavenly",
  "northstar": "northstar-california",
  "kirkwood": "kirkwood",
  "sugar-bowl": "sugar-bowl",
  "mt-rose": "mt-rose-ski-tahoe",
  "diamond-peak": "diamond-peak",
  "sierra-at-tahoe": "sierra-at-tahoe",
  "homewood": "homewood-mountain-resort",
  "boreal": "boreal-mountain-resort",
  "dodge-ridge": "dodge-ridge",
  "bear-valley": "bear-valley",
  "june-mountain": "june-mountain",
  "mountain-high": "mountain-high",
  "snow-summit": "snow-summit",
  "bear-mountain": "bear-mountain-california",
  "snow-valley": "snow-valley",
  "mt-baldy": "mt-baldy-ski-lifts",
  "china-peak": "china-peak",
  "tahoe-donner": "tahoe-donner",
  "soda-springs": "soda-springs",
  "mt-shasta": "mt-shasta-ski-park",
  "badger-pass": "badger-pass",
  "donner-ski-ranch": "donner-ski-ranch",

  // Montana
  "big-sky": "big-sky",
  "whitefish": "whitefish-mountain-resort",
  "bridger-bowl": "bridger-bowl",
  "red-lodge": "red-lodge-mountain",
  "discovery": "discovery-ski-area",
  "lost-trail": "lost-trail-powder-mountain",
  "maverick-mountain": "maverick-mountain",
  "snowbowl": "montana-snowbowl",
  "blacktail-mountain": "blacktail-mountain",
  "great-divide": "great-divide",
  "showdown": "showdown",
  "lookout-pass": "lookout-pass",
  "teton-pass": "teton-pass-ski-area",
  "turner-mountain": "turner-mountain",

  // Wyoming
  "jackson-hole": "jackson-hole",
  "grand-targhee": "grand-targhee-resort",
  "snow-king": "snow-king-mountain",
  "sleeping-giant": "sleeping-giant-ski-area",
  "hogadon": "hogadon",
  "snowy-range": "snowy-range-ski-area",
  "pine-creek": "pine-creek-ski-area",
  "white-pine": "white-pine-ski-area",
  "antelope-butte": "antelope-butte-ski-area",

  // Idaho
  "sun-valley": "sun-valley",
  "schweitzer": "schweitzer",
  "tamarack": "tamarack-resort",
  "brundage": "brundage-mountain",
  "bogus-basin": "bogus-basin",
  "silver-mountain": "silver-mountain",
  "lookout-pass-idaho": "lookout-pass",
  "pomerelle": "pomerelle-mountain-resort",
  "soldier-mountain": "soldier-mountain",
  "magic-mountain": "magic-mountain-idaho",
  "little-ski-hill": "little-ski-hill",
  "pebble-creek": "pebble-creek",
  "kelly-canyon": "kelly-canyon",

  // New Mexico
  "taos": "taos-ski-valley",
  "angel-fire": "angel-fire-resort",
  "ski-santa-fe": "ski-santa-fe",
  "red-river": "red-river-ski-area",
  "sipapu": "sipapu-ski-resort",
  "ski-apache": "ski-apache",
  "sandia-peak": "sandia-peak",
  "pajarito": "pajarito-mountain",

  // Arizona
  "snowbowl-az": "arizona-snowbowl",
  "sunrise-park": "sunrise-park-resort",
  "mt-lemmon": "mt-lemmon-ski-valley",

  // Nevada
  "lee-canyon": "lee-canyon",

  // Vermont
  "killington": "killington",
  "stowe": "stowe-mountain-resort",
  "sugarbush": "sugarbush",
  "okemo": "okemo",
  "stratton": "stratton",
  "mount-snow": "mount-snow",
  "jay-peak": "jay-peak",
  "smugglers-notch": "smugglers-notch",
  "bromley": "bromley",
  "pico": "pico-mountain",
  "magic-mountain-vt": "magic-mountain-vermont",
  "bolton-valley": "bolton-valley",
  "mad-river-glen": "mad-river-glen",
  "burke": "burke-mountain",
  "cochrans": "cochrans-ski-area",
  "suicide-six": "suicide-six",
  "middlebury-snow-bowl": "middlebury-college-snow-bowl",
  "lyndon-outing-club": "lyndon-outing-club",
  "northeast-slopes": "northeast-slopes",
  "ascutney": "ascutney-mountain-resort",
  "prospect-mountain": "prospect-mountain",
  "harwood-hill": "harwood-hill",

  // New Hampshire
  "loon": "loon-mountain",
  "cannon": "cannon-mountain",
  "bretton-woods": "bretton-woods",
  "waterville-valley": "waterville-valley",
  "attitash": "attitash",
  "wildcat": "wildcat-mountain",
  "cranmore": "cranmore-mountain-resort",
  "gunstock": "gunstock",
  "ragged": "ragged-mountain",
  "sunapee": "mount-sunapee",
  "pats-peak": "pats-peak",
  "black-mountain-nh": "black-mountain-new-hampshire",
  "crotched-mountain": "crotched-mountain",
  "king-pine": "king-pine-ski-area",
  "whaleback": "whaleback-mountain",
  "dartmouth-skiway": "dartmouth-skiway",
  "mcintyre-ski-area": "mcintyre-ski-area",
  "highlands-mountain": "highlands-mountain",
  "tenney-mountain": "tenney-mountain",
  "granite-gorge": "granite-gorge",
  "arrowhead": "arrowhead-recreation-area",
  "kanc-recreation-area": "kanc-recreation-area",

  // Maine
  "sugarloaf": "sugarloaf",
  "sunday-river": "sunday-river",
  "saddleback": "saddleback-maine",
  "shawnee-peak": "shawnee-peak",
  "black-mountain-maine": "black-mountain-maine",
  "mt-abram": "mt-abram",
  "big-rock": "big-rock",
  "lost-valley": "lost-valley",
  "camden-snow-bowl": "camden-snow-bowl",
  "titcomb-mountain": "titcomb-mountain",
  "eaton-mountain": "eaton-mountain",
  "lonesome-pine-trails": "lonesome-pine-trails",
  "bigrock-mountain": "bigrock-mountain",
  "hermon-mountain": "hermon-mountain",
  "quoggy-jo": "quoggy-jo",
  "pinnacle-ski-club": "pinnacle-ski-club",
  "spruce-mountain": "spruce-mountain-maine",

  // New York
  "whiteface": "whiteface-mountain",
  "gore": "gore-mountain",
  "hunter": "hunter-mountain",
  "windham": "windham-mountain",
  "belleayre": "belleayre",
  "bristol": "bristol-mountain",
  "holiday-valley": "holiday-valley",
  "greek-peak": "greek-peak",
  "labrador-mountain": "labrador-mountain",
  "song-mountain": "song-mountain",
  "titus-mountain": "titus-mountain",
  "west-mountain": "west-mountain",
  "mccauley-mountain": "mccauley-mountain",
  "oak-mountain": "oak-mountain",
  "plattekill": "plattekill-mountain",
  "snow-ridge": "snow-ridge",
  "toggenburg": "toggenburg",
  "swain": "swain",
  "kissing-bridge": "kissing-bridge",
  "holimont": "holimont",
  "peek-n-peak": "peeknpeak",
  "dry-hill": "dry-hill",
  "willard-mountain": "willard-mountain",
  "catamount": "catamount-ski-area",
  "thunder-ridge": "thunder-ridge",
  "mount-peter": "mount-peter",
  "woods-valley": "woods-valley",
  "maple-ski-ridge": "maple-ski-ridge",
  "brantling": "brantling",
  "hunt-hollow": "hunt-hollow",
  "camillus-ski-association": "camillus-ski-association",
  "cockaigne": "cockaigne",
  "four-seasons": "four-seasons",
  "mt-pisgah": "mt-pisgah",
  "royal-mountain": "royal-mountain",
  "alfred-station": "alfred-station",

  // Massachusetts
  "wachusett": "wachusett-mountain",
  "jiminy-peak": "jiminy-peak",
  "berkshire-east": "berkshire-east",
  "butternut": "butternut",
  "bousquet": "bousquet",
  "ski-ward": "ski-ward",
  "nashoba-valley": "nashoba-valley",
  "blue-hills": "blue-hills-ski-area",
  "ski-bradford": "ski-bradford",
  "mt-tom": "mt-tom",

  // Connecticut
  "mohawk-mountain": "mohawk-mountain",
  "ski-sundown": "ski-sundown",
  "mount-southington": "mount-southington",
  "powder-ridge": "powder-ridge",

  // Pennsylvania
  "seven-springs": "seven-springs",
  "blue-mountain": "blue-mountain",
  "camelback": "camelback-mountain",
  "jack-frost": "jack-frost",
  "big-boulder": "big-boulder",
  "elk-mountain": "elk-mountain",
  "shawnee-mountain": "shawnee-mountain",
  "liberty-mountain": "liberty-mountain-resort",
  "roundtop": "roundtop-mountain-resort",
  "whitetail": "whitetail-resort",
  "bear-creek": "bear-creek-mountain-resort",
  "hidden-valley": "hidden-valley-pa",
  "laurel-mountain": "laurel-mountain",
  "tussey-mountain": "tussey-mountain",
  "spring-mountain": "spring-mountain-adventures",
  "blue-knob": "blue-knob",
  "boyce-park": "boyce-park",
  "montage-mountain": "montage-mountain",
  "mystic-mountain-at-nemacolin": "mystic-mountain",
  "ski-sawmill": "ski-sawmill",

  // West Virginia
  "snowshoe": "snowshoe-mountain",
  "canaan-valley": "canaan-valley-resort",
  "timberline": "timberline-mountain",
  "winterplace": "winterplace-ski-resort",
  "oglebay": "oglebay-resort",
  "alpine-lake": "alpine-lake-resort",

  // Michigan
  "boyne-mountain": "boyne-mountain",
  "boyne-highlands": "boyne-highlands",
  "nubs-nob": "nubs-nob",
  "crystal-mountain": "crystal-mountain-michigan",
  "shanty-creek": "shanty-creek",
  "caberfae-peaks": "caberfae-peaks",
  "big-powderhorn": "big-powderhorn-mountain",
  "mount-bohemia": "mount-bohemia",
  "indianhead-mountain": "indianhead-mountain",
  "blackjack": "blackjack",
  "ski-brule": "ski-brule",
  "marquette-mountain": "marquette-mountain",
  "mont-ripley": "mont-ripley",
  "pine-mountain": "pine-mountain-michigan",
  "mt-brighton": "mt-brighton",
  "mt-holly": "mt-holly",
  "pine-knob": "pine-knob",
  "snow-snake": "snow-snake-mountain",
  "timber-ridge": "timber-ridge-michigan",
  "treetops": "treetops-resort",
  "bittersweet": "bittersweet",
  "cannonsburg": "cannonsburg",
  "swiss-valley": "swiss-valley",
  "porcupine-mountains": "porcupine-mountains",
  "apple-mountain": "apple-mountain",
  "el-nino": "el-nino-ski-area",
  "otsego-club": "otsego-club",

  // Wisconsin
  "granite-peak": "granite-peak",
  "devil's-head": "devils-head-resort",
  "cascade-mountain": "cascade-mountain",
  "whitecap-mountains": "whitecap-mountains",
  "nordic-mountain": "nordic-mountain",
  "the-rock": "the-rock-snowpark",
  "trollhaugen": "trollhaugen",
  "tyrol-basin": "tyrol-basin",
  "mount-la-crosse": "mount-la-crosse",
  "wilmot": "wilmot-mountain",
  "grand-geneva": "grand-geneva-resort",
  "sunburst": "sunburst-ski-area",
  "little-switzerland": "little-switzerland",
  "christmas-mountain": "christmas-mountain-village",
  "christie-mountain": "christie-mountain",
  "bruce-mound": "bruce-mound",
  "skyline": "skyline",

  // Minnesota
  "lutsen": "lutsen-mountains",
  "spirit-mountain": "spirit-mountain",
  "giants-ridge": "giants-ridge",
  "afton-alps": "afton-alps",
  "buck-hill": "buck-hill",
  "welch-village": "welch-village",
  "wild-mountain": "wild-mountain",
  "hyland-hills": "hyland-hills",
  "powder-ridge-mn": "powder-ridge-minnesota",
  "coffee-mill": "coffee-mill",
  "andes-tower-hills": "andes-tower-hills",
  "buena-vista": "buena-vista",
  "detroit-mountain": "detroit-mountain",
  "mount-kato": "mount-kato",
  "quadna-mountain": "quadna-mountain",
  "elm-creek": "elm-creek",
  "theodore-wirth": "theodore-wirth",

  // Oregon
  "mt-bachelor": "mt-bachelor",
  "mt-hood-meadows": "mt-hood-meadows",
  "timberline": "timberline-lodge",
  "mt-hood-skibowl": "mt-hood-skibowl",
  "mt-ashland": "mt-ashland",
  "hoodoo": "hoodoo-ski-area",
  "anthony-lakes": "anthony-lakes",
  "willamette-pass": "willamette-pass",
  "warner-canyon": "warner-canyon",
  "spout-springs": "spout-springs",
  "ferguson-ridge": "ferguson-ridge",

  // Washington
  "crystal-mountain": "crystal-mountain",
  "stevens-pass": "stevens-pass",
  "the-summit-at-snoqualmie": "the-summit-at-snoqualmie",
  "mt-baker": "mt-baker",
  "white-pass": "white-pass",
  "mission-ridge": "mission-ridge",
  "loup-loup": "loup-loup",
  "hurricane-ridge": "hurricane-ridge",
  "49-degrees-north": "49-degrees-north",
  "bluewood": "bluewood",
  "echo-valley": "echo-valley",
  "badger-mountain": "badger-mountain",
  "ski-acres": "ski-acres",

  // Alaska
  "alyeska": "alyeska-resort",
  "eaglecrest": "eaglecrest",
  "hilltop": "hilltop-ski-area",
  "arctic-valley": "arctic-valley",
  "moose-mountain": "moose-mountain-alaska",

  // North Carolina
  "sugar-mountain": "sugar-mountain",
  "beech-mountain": "beech-mountain-resort",
  "appalachian-ski-mountain": "appalachian-ski-mountain",
  "cataloochee": "cataloochee-ski-area",
  "wolf-ridge": "wolf-ridge",
  "sapphire-valley": "sapphire-valley",

  // Virginia
  "wintergreen": "wintergreen-resort",
  "massanutten": "massanutten",
  "bryce": "bryce-resort",
  "the-homestead": "the-homestead",

  // Tennessee
  "ober-gatlinburg": "ober-gatlinburg",

  // Georgia
  "sky-valley": "sky-valley",

  // Alabama
  "cloudmont": "cloudmont",

  // Ohio
  "mad-river-mountain": "mad-river-mountain",
  "boston-mills-brandywine": "boston-mills-brandywine",
  "snow-trails": "snow-trails",
  "alpine-valley": "alpine-valley-ohio",
  "clear-fork": "clear-fork",

  // Indiana
  "perfect-north": "perfect-north-slopes",
  "paoli-peaks": "paoli-peaks",

  // Iowa
  "sundown-mountain": "sundown-mountain",
  "mt-crescent": "mt-crescent",
  "seven-oaks": "seven-oaks",
  "sleepy-hollow": "sleepy-hollow-iowa",

  // Missouri
  "hidden-valley": "hidden-valley-missouri",
  "snow-creek": "snow-creek",
};

export async function POST() {
  try {
    const db = getDb();
    let updated = 0;
    let notFound = 0;

    // Get all resorts
    const allResorts = await db.select().from(resorts);

    for (const resort of allResorts) {
      const skiresortinfoId = slugToSkiResortInfoId[resort.slug];

      if (skiresortinfoId && resort.skiresortinfoId !== skiresortinfoId) {
        await db
          .update(resorts)
          .set({ skiresortinfoId })
          .where(eq(resorts.id, resort.id));
        updated++;
      } else if (!skiresortinfoId && !resort.skiresortinfoId) {
        notFound++;
      }
    }

    return NextResponse.json({
      total: allResorts.length,
      updated,
      notFound,
      message: `Updated ${updated} resorts with skiresortinfoId`,
    });
  } catch (error) {
    console.error("Error updating resort IDs:", error);
    return NextResponse.json(
      { error: "Failed to update resort IDs" },
      { status: 500 }
    );
  }
}
