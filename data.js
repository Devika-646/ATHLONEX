/* ATHLONEX – data.js
   All sports + sample competition generator.
   Change CONFIG.officialCode before you deploy! */

const CONFIG = {
  appName: "ATHLONEX",
  version: "1.0.0",
  officialCode: "ATHLONEX-OFFICIAL",   // code a sports director must enter to register as an Official
  baseDate: "2026-11-15"               // sample events are spread over the year after this date
};

const LEVELS = ["District", "State", "Club", "College / University", "Zonal", "National", "International"];

const CATEGORIES = [
  "Olympic (Summer)", "Olympic (Winter)", "Combat & Martial Arts", "Water & Aquatic",
  "Indigenous & Traditional", "Racket & Ball Games", "Strength, Fitness & Dance",
  "Athletics & Endurance", "Mind Sports", "Adventure, Motor & Roller",
  "Para & Special", "Precision & Recreation"
];

const SPORT_DATA = {
  "Olympic (Summer)": "Archery|Artistic Gymnastics|Rhythmic Gymnastics|Trampoline Gymnastics|Athletics (Track & Field)|Badminton|Basketball|3x3 Basketball|Volleyball|Beach Volleyball|Boxing|Canoe Slalom|Canoe Sprint|Road Cycling|Track Cycling|BMX Racing|BMX Freestyle|Mountain Biking|Diving|Equestrian (Dressage)|Equestrian (Eventing)|Equestrian (Jumping)|Fencing|Football|Golf|Handball|Hockey|Judo|Modern Pentathlon|Rowing|Rugby Sevens|Sailing|Shooting (Rifle)|Shooting (Pistol)|Shooting (Shotgun - Trap & Skeet)|Skateboarding|Sport Climbing|Surfing|Swimming|Artistic Swimming|Table Tennis|Taekwondo|Tennis|Triathlon|Water Polo|Weightlifting|Freestyle Wrestling|Greco-Roman Wrestling|Marathon Swimming|Breaking (Breakdance)|Cricket|Lacrosse|Flag Football|Squash|Baseball|Softball",
  "Olympic (Winter)": "Alpine Skiing|Cross-Country Skiing|Biathlon|Ski Jumping|Nordic Combined|Freestyle Skiing|Snowboarding|Ski Mountaineering|Figure Skating|Speed Skating|Short Track Speed Skating|Ice Hockey|Curling|Bobsleigh|Luge|Skeleton",
  "Combat & Martial Arts": "Karate|Kickboxing|Muay Thai|Mixed Martial Arts (MMA)|Wushu (Taolu)|Wushu (Sanda)|Sambo|Brazilian Jiu-Jitsu|Jiu-Jitsu (Ne-Waza)|Kudo|Pencak Silat|Aikido|Kendo|Savate|Hapkido|Taekwon-Do (ITF)|Kurash|Pankration|Krav Maga|Arm Wrestling",
  "Water & Aquatic": "Dragon Boat|Kayaking|Canoe Polo|Water Skiing|Wakeboarding|Windsurfing|Kitesurfing|Stand-Up Paddleboarding|Underwater Hockey|Finswimming|Open Water Swimming|Lifesaving|White-Water Rafting|Jet Ski Racing|Freediving|Scuba Diving (Sport)|Snake Boat Racing (Vallamkali)|Aquathlon",
  "Indigenous & Traditional": "Kabaddi|Kho-Kho|Mallakhamb|Rope Mallakhamb|Kalaripayattu|Gatka|Thang-Ta|Silambam|Mardani Khel|Kushti (Pehlwani)|Lagori (Seven Stones)|Yogasana|Atya-Patya|Langdi|Gilli-Danda|Mukna|Teer (Traditional Archery)|Tug of War|Inbuan Wrestling|Cheibi Gad-ga|Sqay (Martial Art)",
  "Racket & Ball Games": "Pickleball|Padel|Beach Tennis|Soft Tennis|Ball Badminton|Sepak Takraw|Throwball|Roll Ball|Netball|Dodgeball|Ultimate Frisbee|Futsal|Beach Soccer|Beach Handball|Rugby Union (15s)|Korfball|Tennis-Ball Cricket|Hockey5s|Speedminton|Footvolley|Cycle Polo|Gateball",
  "Strength, Fitness & Dance": "Powerlifting (Classic)|Powerlifting (Equipped)|Bench Press|Deadlift|Bodybuilding & Physique|Strongman|Functional Fitness|Calisthenics|Kettlebell Sport|Aerobic Gymnastics|Acrobatic Gymnastics|Tumbling|Cheerleading|Dance Sport",
  "Athletics & Endurance": "Sprints & Hurdles|Middle & Long Distance|Jumps (Long, High, Triple, Pole Vault)|Throws (Javelin, Discus, Shot, Hammer)|Relays|Marathon|Half Marathon|Road Running (10K)|Race Walking|Cross Country|Steeplechase|Decathlon & Heptathlon|Trail Running|Ultra Running|Duathlon|Orienteering",
  "Mind Sports": "Chess|Rapid Chess|Blitz Chess|Carrom|Contract Bridge|Draughts|Go|Esports|Speedcubing|Scrabble",
  "Adventure, Motor & Roller": "Roller Skating (Speed)|Roller Skating (Artistic)|Roller Hockey|Inline Hockey|Scooter Freestyle|Mountaineering|Trekking|Rock Climbing (Outdoor)|Paragliding|Skydiving|Karting|Motorcycle Racing|Rally|Drag Racing|Polo|Tent Pegging|Cycling (Randonneuring)",
  "Para & Special": "Para Athletics|Para Swimming|Para Badminton|Para Archery|Para Table Tennis|Para Shooting|Para Powerlifting|Para Taekwondo|Para Judo|Para Cycling|Para Rowing|Para Canoe|Wheelchair Basketball|Wheelchair Tennis|Wheelchair Cricket|Sitting Volleyball|Blind Cricket|Goalball|Blind Football|Deaf Cricket|Special Olympics (Athletics)|Special Olympics (Unified Football)",
  "Precision & Recreation": "Ten-pin Bowling|Billiards|Snooker|Darts|Petanque|Croquet|Angling (Casting)|Bocce|Disc Golf"
};

// Sports that also appear under another filter
const EXTRA_TAGS = {
  "Combat & Martial Arts": ["Boxing","Judo","Taekwondo","Freestyle Wrestling","Greco-Roman Wrestling","Fencing","Kushti (Pehlwani)","Kalaripayattu","Gatka","Thang-Ta","Silambam","Mardani Khel","Inbuan Wrestling","Mukna","Sqay (Martial Art)","Cheibi Gad-ga","Para Taekwondo","Para Judo"],
  "Water & Aquatic": ["Swimming","Diving","Water Polo","Rowing","Sailing","Canoe Slalom","Canoe Sprint","Surfing","Artistic Swimming","Marathon Swimming","Triathlon","Snake Boat Racing (Vallamkali)","Para Swimming","Para Rowing","Para Canoe"],
  "Racket & Ball Games": ["Badminton","Tennis","Table Tennis","Squash","Football","Hockey","Basketball","3x3 Basketball","Volleyball","Beach Volleyball","Handball","Cricket","Rugby Sevens","Baseball","Softball","Lacrosse","Kabaddi","Kho-Kho","Para Badminton","Para Table Tennis"],
  "Strength, Fitness & Dance": ["Weightlifting","Para Powerlifting","Artistic Gymnastics","Rhythmic Gymnastics","Trampoline Gymnastics","Breaking (Breakdance)","Yogasana"],
  "Athletics & Endurance": ["Athletics (Track & Field)","Triathlon","Modern Pentathlon","Marathon Swimming","Para Athletics"],
  "Indigenous & Traditional": ["Snake Boat Racing (Vallamkali)"],
  "Precision & Recreation": ["Golf","Archery"]
};

const SPORTS = [];
Object.entries(SPORT_DATA).forEach(([cat, str]) => {
  str.split("|").forEach(name => SPORTS.push({ name, cat, extra: [] }));
});
Object.entries(EXTRA_TAGS).forEach(([cat, names]) => {
  names.forEach(n => { const s = SPORTS.find(x => x.name === n); if (s && s.cat !== cat) s.extra.push(cat); });
});
SPORTS.forEach(s => { s.cats = [s.cat, ...s.extra]; });
SPORTS.sort((a, b) => a.name.localeCompare(b.name));
const SPORT_MAP = Object.fromEntries(SPORTS.map(s => [s.name, s]));

const CITIES = {
  "Bengaluru":"Karnataka","Mysuru":"Karnataka","Mangaluru":"Karnataka","Hubballi":"Karnataka","Belagavi":"Karnataka",
  "Chennai":"Tamil Nadu","Coimbatore":"Tamil Nadu","Hyderabad":"Telangana","Kochi":"Kerala","Thiruvananthapuram":"Kerala",
  "Mumbai":"Maharashtra","Pune":"Maharashtra","Nagpur":"Maharashtra","Ahmedabad":"Gujarat","Jaipur":"Rajasthan",
  "New Delhi":"Delhi","Chandigarh":"Chandigarh","Ludhiana":"Punjab","Patiala":"Punjab","Lucknow":"Uttar Pradesh",
  "Kolkata":"West Bengal","Bhubaneswar":"Odisha","Guwahati":"Assam","Imphal":"Manipur","Ranchi":"Jharkhand",
  "Bhopal":"Madhya Pradesh","Indore":"Madhya Pradesh","Patna":"Bihar","Dehradun":"Uttarakhand","Shillong":"Meghalaya",
  "Visakhapatnam":"Andhra Pradesh","Vijayawada":"Andhra Pradesh","Panaji":"Goa"
};
const CITY_NAMES = Object.keys(CITIES);
const ZONES = ["South Zone","North Zone","East Zone","West Zone","Central Zone","North-East Zone"];
const AGE_CATS = ["Sub-Junior (U-14)","Junior (U-18)","Youth (U-21)","Senior (Open)","Masters (35+)"];

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const INTL_EXCLUDE = new Set(["Indigenous & Traditional", "Precision & Recreation"]);
const INTL_FORCE = new Set(["Kabaddi", "Kho-Kho", "Mallakhamb", "Yogasana", "Billiards", "Snooker", "Ten-pin Bowling"]);

/* SAMPLE events — generated placeholders so the portal is fully usable on day 1.
   Real events: sports officials add them in the Official portal (Events tab). */
function buildSampleEvents() {
  const base = new Date(CONFIG.baseDate + "T00:00:00");
  const times = ["07:00", "08:00", "09:00", "10:00", "14:00", "16:00"];
  const venues = {
    "District": ["District Sports Stadium", "District Indoor Hall", "Government College Ground"],
    "State": ["State Sports Complex", "State Indoor Stadium", "Sports Authority Arena"],
    "Club": ["Sports Club Arena", "Club Indoor Courts", "Gymkhana Ground"],
    "College / University": ["University Sports Complex", "Campus Main Ground", "University Indoor Stadium"],
    "Zonal": ["Zonal Sports Centre", "Regional Stadium", "Zonal Indoor Arena"],
    "National": ["National Stadium", "National Sports Complex", "National Indoor Arena"],
    "International": ["International Sports Arena", "Continental Games Venue", "World Championship Venue"]
  };
  const organiser = (lvl, sp) => ({
    "District": `District ${sp} Association`, "State": `State ${sp} Association`, "Club": "Affiliated Sports Clubs",
    "College / University": "University Sports Board", "Zonal": "Zonal Sports Council", "National": `National ${sp} Federation`,
    "International": "Continental / World Federation"
  })[lvl];
  const out = [];
  SPORTS.forEach(s => {
    const intl = !INTL_EXCLUDE.has(s.cat) || INTL_FORCE.has(s.name);
    LEVELS.forEach((lvl, li) => {
      if (lvl === "International" && !intl) return;
      const h = hash(s.name + "|" + lvl);
      const d = new Date(base); d.setDate(d.getDate() + (h % 300) + li * 6);
      const city = CITY_NAMES[h % CITY_NAMES.length];
      const zone = ZONES[h % ZONES.length];
      const cat = lvl === "College / University" ? ["Inter-College Men", "Inter-College Women", "Inter-University Men & Women"][h % 3] : AGE_CATS[h % AGE_CATS.length];
      const label = lvl === "College / University" ? "Inter-University" : lvl === "Zonal" ? zone : lvl;
      out.push({
        id: "S" + h.toString(36),
        sport: s.name, cats: s.cats, level: lvl,
        title: `${label} ${s.name} Championship 2026-27`,
        date: d.toISOString().slice(0, 10), time: times[h % times.length],
        city: lvl === "International" ? ["New Delhi", "Bengaluru", "Mumbai", "Hyderabad"][h % 4] : city,
        state: CITIES[lvl === "International" ? ["New Delhi", "Bengaluru", "Mumbai", "Hyderabad"][h % 4] : city],
        venue: venues[lvl][h % 3], category: cat, organiser: organiser(lvl, s.name.split(" (")[0]), sample: true
      });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
