// Cammio Studio Hub — text (Arabic / English)
export const T = {
  // auth
  client:{ar:"كلاينت",en:"Client"}, editor:{ar:"إديتور",en:"Editor"}, admin:{ar:"أدمن",en:"Admin"}, pending:{ar:"مستني تفعيل",en:"Pending"},
  user:{ar:"اسم المستخدم",en:"Username"}, pass:{ar:"الباسورد",en:"Password"}, signIn:{ar:"دخول",en:"Sign in"}, signOut:{ar:"خروج",en:"Sign out"},
  badLogin:{ar:"اليوزر أو الباسورد غلط",en:"Wrong username or password"}, wrongSide:{ar:"الحساب ده مش من النوع ده",en:"This account isn't on this side"},
  noRole:{ar:"الحساب لسه متفعّلش",en:"Account not activated yet"}, demo:{ar:"تجربة",en:"Demo"}, err:{ar:"حصل خطأ، جرّب تاني",en:"Something went wrong, try again"},
  // nav
  inbox:{ar:"المطلوب مني",en:"My inbox"}, clients:{ar:"الكلاينتس",en:"Clients"}, team:{ar:"التيم",en:"Team"}, money:{ar:"الفلوس",en:"Money"}, accounts:{ar:"الحسابات",en:"Accounts"},
  myWork:{ar:"شغلي",en:"My work"}, myRecord:{ar:"سجلّي",en:"My record"}, myProjects:{ar:"مشاريعي",en:"My projects"},
  notifs:{ar:"الإشعارات",en:"Notifications"}, myAccount:{ar:"حسابي",en:"My account"}, tour:{ar:"جولة",en:"Tour"}, enableN:{ar:"فعّل الإشعارات",en:"Enable notifications"},
  // stages
  st0:{ar:"جديد",en:"New"}, st1:{ar:"اتستلم",en:"Received"}, st2:{ar:"تحضير",en:"Prep"}, st3:{ar:"فيرست كات",en:"First cut"},
  st4:{ar:"جرافيكس",en:"Graphics"}, st5:{ar:"ساوند",en:"Sound"}, st6:{ar:"مراجعة",en:"Review"}, st7:{ar:"اتسلّم",en:"Delivered"},
  // generic
  open:{ar:"فتح",en:"Open"}, save:{ar:"احفظ",en:"Save"}, saved:{ar:"اتحفظ ✓",en:"Saved ✓"}, send:{ar:"ابعت",en:"Send"}, sent:{ar:"اتبعت ✓",en:"Sent ✓"},
  cancel:{ar:"إلغاء",en:"Cancel"}, edit:{ar:"تعديل",en:"Edit"}, del:{ar:"مسح",en:"Delete"}, delSure:{ar:"متأكد؟ دوس تاني",en:"Sure? Tap again"}, add:{ar:"ضيف",en:"Add"},
  close:{ar:"قفل",en:"Close"}, back:{ar:"رجوع",en:"Back"}, all:{ar:"الكل",en:"All"}, none:{ar:"مفيش حاجة هنا",en:"Nothing here"}, allGood:{ar:"كله تمام ✓ مفيش حاجة مستنياك",en:"All clear ✓ nothing waiting for you"},
  late:{ar:"متأخر",en:"Late"}, today:{ar:"النهارده",en:"Today"}, tomorrow:{ar:"بكره",en:"Tomorrow"}, later:{ar:"بعدين",en:"Later"}, done:{ar:"خلص",en:"Done"},
  due:{ar:"الديدلاين",en:"Due"}, newTag:{ar:"جديد",en:"New"}, task:{ar:"مهمة",en:"Task"}, video:{ar:"فيديو",en:"Video"}, reel:{ar:"ريل",en:"Reel"},
  project:{ar:"المشروع",en:"Project"}, projects:{ar:"المشاريع",en:"Projects"}, theEditor:{ar:"الإديتور",en:"The editor"},
  material:{ar:"الماتيريال",en:"Material"}, reference:{ar:"الريفرنس",en:"Reference"}, details:{ar:"تفاصيل",en:"Details"},
  now:{ar:"دلوقتي",en:"now"}, m:{ar:"د",en:"m"}, h:{ar:"س",en:"h"}, d:{ar:"ي",en:"d"},
  // panel tabs
  pNext:{ar:"الخطوة الجاية",en:"Next step"}, pNotes:{ar:"النوتس",en:"Notes"}, pDeliv:{ar:"التسليمات",en:"Deliveries"}, pActivity:{ar:"النشاط",en:"Activity"}, pInfo:{ar:"المعلومات",en:"Info"},
  // statuses
  clientSees:{ar:"الكلاينت شايف",en:"Client sees"}, editorAt:{ar:"الإديتور عند",en:"Editor at"},
  dPending:{ar:"مستني موافقتك",en:"Awaiting your OK"}, dPendingEd:{ar:"مستني موافقة Cammio",en:"Awaiting Cammio"}, dApproved:{ar:"اتبعت للكلاينت",en:"Sent to client"}, dHeld:{ar:"اتوقف",en:"Held"}, dSuper:{ar:"اتبدل بنسخة أحدث",en:"Replaced"},
  draft:{ar:"درافت",en:"Draft"}, round:{ar:"جولة",en:"Round"}, rounds:{ar:"جولات المراجعة",en:"Review rounds"},
  // admin actions
  approveSend:{ar:"ابعت للكلاينت",en:"Send to client"}, hold:{ar:"استنى",en:"Hold"}, approveStage:{ar:"وافق",en:"Approve"}, askEditor:{ar:"اسأل الإديتور",en:"Ask the editor"},
  stageReq:{ar:"طلب تحديث مرحلة",en:"Stage update"}, draftIn:{ar:"درافت وصل",en:"Draft delivered"}, setStage:{ar:"غيّر المرحلة يدوي",en:"Set stage manually"},
  assignTo:{ar:"سلّم لـ",en:"Assign to"}, assign:{ar:"وافق وسلّم",en:"Approve & assign"}, newRequests:{ar:"طلبات جديدة",en:"New requests"},
  needsOk:{ar:"مستني موافقتك",en:"Needs your OK"}, clientReplies:{ar:"رد الكلاينتس",en:"Client replies"}, lateItems:{ar:"متأخر",en:"Late"},
  // editor actions
  moveTo:{ar:"وصلت لـ",en:"Reached"}, deliver:{ar:"سلّم",en:"Deliver"}, deliverDraft:{ar:"سلّم درافت",en:"Deliver a draft"}, step1:{ar:"١. ارفع على Krock",en:"1. Upload on Krock"},
  step2:{ar:"٢. الصق اللينك",en:"2. Paste the link"}, linkPh:{ar:"https://platform.krock.io/…",en:"https://platform.krock.io/…"}, noteOpt:{ar:"ملاحظة لـCammio (اختياري)",en:"Note for Cammio (optional)"},
  sendToCammio:{ar:"ابعت لـCammio",en:"Send to Cammio"}, waitingCammio:{ar:"مستني موافقة Cammio",en:"Waiting for Cammio"}, withClient:{ar:"عند الكلاينت للمراجعة",en:"With the client for review"},
  clientNotesIn:{ar:"الكلاينت بعت ملاحظاته",en:"The client sent notes"}, gotNotes:{ar:"استلمت، ببدأ أعدّل",en:"Got it, revising"}, needLink:{ar:"الصق لينك صحيح",en:"Paste a valid link"},
  checkin:{ar:"إنت فين؟",en:"Where are you?"}, checkinSub:{ar:"تشييك كل ٣ ساعات",en:"Every 3 hours"}, nextCheck:{ar:"التشييك الجاي",en:"Next check-in"}, sendUpdate:{ar:"ابعت التحديث",en:"Send update"},
  whichItem:{ar:"بتسلّم إيه؟",en:"What are you delivering?"}, nothingToDeliver:{ar:"مفيش حاجة مستنية تسليم",en:"Nothing waiting for delivery"}, finishedTask:{ar:"خلصت المهمة كلها",en:"Task fully done"},
  // client actions
  draftReady:{ar:"الدرافت جاهز تراجعه",en:"Draft ready for your review"}, openDraft:{ar:"افتح الدرافت",en:"Open draft"}, notesDone:{ar:"خلصت ملاحظاتي",en:"I've left my notes"},
  approveFinal:{ar:"اعتماد نهائي ✓",en:"Approve final ✓"}, noRounds:{ar:"خلصت الـ٣ جولات — أي تعديل زيادة مع Cammio",en:"All 3 rounds used — extra changes via Cammio"},
  notesSentWait:{ar:"ملاحظاتك وصلت، الإديتور هيبدأ يعدّل",en:"Your notes arrived; the editor will revise"}, revising:{ar:"الإديتور بيعدّل دلوقتي",en:"The editor is revising now"},
  askEd:{ar:"اسأل الإديتور هو فين",en:"Ask the editor for status"}, asked:{ar:"اتسأل ✓",en:"Asked ✓"}, newRequest:{ar:"طلب جديد",en:"New request"}, underReview:{ar:"الطلب بيتراجع",en:"Request under review"},
  needsReview:{ar:"محتاج مراجعتك",en:"Needs your review"}, package:{ar:"الباكدج",en:"Package"},
  // notes
  addNote:{ar:"ضيف نوتة",en:"Add note"}, tc:{ar:"تايم كود",en:"Timecode"}, cue:{ar:"كلمة مميزة",en:"Cue word"}, visual:{ar:"المشهد المطلوب",en:"Visual"}, sfx:{ar:"صوت / حركة",en:"SFX / move"},
  fromSheet:{ar:"من شيت جوجل",en:"From a Google Sheet"}, readSheet:{ar:"اقرا الشيت",en:"Read sheet"}, pasteRows:{ar:"أو الصق الصفوف",en:"or paste rows"},
  found:{ar:"نوتة اتعرفت",en:"notes found"}, addThem:{ar:"ضيفهم",en:"Add them"}, clearNotes:{ar:"امسح كل النوتس",en:"Clear all notes"},
  notPublic:{ar:"الشيت مش مفتوح — خلّيه Anyone with the link",en:"Sheet isn't open — set Anyone with the link"}, badSheet:{ar:"ده مش لينك شيت جوجل",en:"Not a Google Sheet link"}, noRows:{ar:"ملقتش صفوف",en:"No rows found"},
  // forms
  title:{ar:"الاسم",en:"Title"}, type:{ar:"النوع",en:"Type"}, tReels:{ar:"ريلز",en:"Reels"}, tLong:{ar:"يوتيوب طويل",en:"Long-form"}, tMotion:{ar:"موشن",en:"Motion"},
  drive:{ar:"لينك الدرايف",en:"Drive link"}, refOpt:{ar:"ريفرنس (اختياري)",en:"Reference (optional)"}, notesFor:{ar:"ملاحظات للإديتور",en:"Notes for the editor"},
  count:{ar:"عدد الفيديوهات",en:"Videos"}, firstDue:{ar:"أول ديدلاين",en:"First deadline"}, cadence:{ar:"التسليم",en:"Delivery"},
  cOnce:{ar:"مرة واحدة",en:"All at once"}, cDaily:{ar:"كل يوم",en:"Daily"}, c2:{ar:"كل يومين",en:"Every 2 days"}, cWeek:{ar:"كل أسبوع",en:"Weekly"},
  need:{ar:"الاسم ولينك الدرايف مطلوبين",en:"Title and Drive link are required"}, forClient:{ar:"لكلاينت",en:"For client"}, withEditor:{ar:"مع إديتور",en:"With editor"},
  newProject:{ar:"مشروع جديد",en:"New project"}, projSettings:{ar:"إعدادات المشروع",en:"Project settings"}, members:{ar:"مين يشوف المشروع",en:"Who sees this project"}, owner:{ar:"صاحب الطلب",en:"Owner"},
  changeEditor:{ar:"الإديتور",en:"Editor"},
  newTask:{ar:"مهمة جديدة",en:"New task"}, taskFor:{ar:"لمين",en:"For"}, stages:{ar:"المراحل",en:"Stages"}, stagePh:{ar:"اكتب مرحلة ودوس Enter",en:"Type a stage, press Enter"},
  noStages:{ar:"من غير مراحل: خلصت / لسه",en:"No stages: done / not done"}, linkOpt:{ar:"لينك (اختياري)",en:"Link (optional)"}, detailsOpt:{ar:"تفاصيل (اختياري)",en:"Details (optional)"},
  delivery:{ar:"التسليم",en:"Delivery"}, needTask:{ar:"اختار إديتور واكتب المهمة",en:"Pick an editor and write the task"},
  // money
  month:{ar:"الشهر",en:"Month"}, deliveredN:{ar:"اتسلّم",en:"Delivered"}, earned:{ar:"المستحق",en:"Earned"}, lates:{ar:"تأخير",en:"Lates"}, deduction:{ar:"خصم",en:"Deduction"}, net:{ar:"الصافي",en:"Net"},
  early:{ar:"بدري",en:"Early"}, notYet:{ar:"لسه",en:"Not yet"}, rates:{ar:"الأسعار",en:"Rates"}, rules:{ar:"القواعد",en:"Rules"},
  rule:{ar:"مسموح {a} تأخير في الشهر · بعدها كل تأخير بـ {p} · كل تسليم بدري بيشيل تأخير",en:"{a} lates allowed per month · then {p} each · each early delivery cancels one"},
  sAllow:{ar:"تأخيرات مسموحة / شهر",en:"Allowed lates / month"}, sPenalty:{ar:"خصم كل تأخير زيادة",en:"Deduction per extra late"}, sEarly:{ar:"بدري لو قبل الديدلاين بـ (ساعات)",en:"Early if this many hours before due"}, sCurrency:{ar:"العملة",en:"Currency"},
  owed:{ar:"عليه",en:"Owed"}, paid:{ar:"دفع",en:"Paid"}, remaining:{ar:"الباقي",en:"Remaining"}, pricePerVideo:{ar:"سعر الفيديو",en:"Price / video"}, editorsMoney:{ar:"التيم",en:"Team"}, clientsMoney:{ar:"الكلاينتس",en:"Clients"},
  // accounts
  name:{ar:"الاسم",en:"Name"}, role:{ar:"النوع",en:"Role"}, create:{ar:"اعمل الحساب",en:"Create"}, accErr:{ar:"اليوزر موجود أو الباسورد أقل من ٦",en:"Username taken or password under 6"},
  curPass:{ar:"الباسورد الحالي",en:"Current password"}, passUnknown:{ar:"مش معروف — حط باسورد جديد",en:"Unknown — set a new one"}, newPassOpt:{ar:"باسورد جديد (اختياري)",en:"New password (optional)"},
  show:{ar:"إظهار",en:"Show"}, hide:{ar:"إخفاء",en:"Hide"}, copyLogin:{ar:"نسخ بيانات الدخول",en:"Copy login"}, copied:{ar:"اتنسخ ✓",en:"Copied ✓"}, delAccount:{ar:"مسح الحساب",en:"Delete account"},
  pkgSize:{ar:"حجم الباكدج",en:"Package size"}, photo:{ar:"غيّر الصورة",en:"Change photo"}, titleL:{ar:"الوصف",en:"Title"}, lang:{ar:"اللغة",en:"Language"},
  newPass:{ar:"باسورد جديد",en:"New password"}, changePass:{ar:"غيّر الباسورد",en:"Change password"}, passShort:{ar:"٦ حروف على الأقل",en:"At least 6 characters"}, activateAs:{ar:"فعّل كـ",en:"Activate as"},
  // tour
  next:{ar:"التالي",en:"Next"}, gotIt:{ar:"تمام",en:"Got it"}, skip:{ar:"تخطي",en:"Skip"},
};

// event → sentence. ctx gives names. Editors are masked for clients by ctx.actor().
export const EV = {
  stage_req:      {ar:"{a} وصل لـ {stage} في {item}", en:"{a} reached {stage} on {item}"},
  stage_ok:       {ar:"{item} بقى في مرحلة {stage}", en:"{item} is now at {stage}"},
  stage_hold:     {ar:"Cammio وقّف تحديث {stage} على {item}", en:"Cammio held the {stage} update on {item}"},
  draft_sent:     {ar:"{a} سلّم درافت {round} — {item}", en:"{a} delivered draft {round} — {item}"},
  draft_ok:       {ar:"درافت {round} من {item} جاهز للمراجعة", en:"Draft {round} of {item} is ready to review"},
  draft_hold:     {ar:"Cammio وقّف درافت {round} — {item}", en:"Cammio held draft {round} — {item}"},
  notes_added:    {ar:"{a} ضاف {n} نوتس على {item}", en:"{a} added {n} notes on {item}"},
  notes_all_done: {ar:"{a} خلّص كل النوتس على {item}", en:"{a} finished all notes on {item}"},
  review_notes:   {ar:"{a} بعت ملاحظات المراجعة على {item}", en:"{a} sent review notes on {item}"},
  client_approved:{ar:"{a} اعتمد {item} نهائي ✓", en:"{a} approved {item} ✓"},
  revising:       {ar:"{a} بدأ يعدّل {item}", en:"{a} started revising {item}"},
  ask_status:     {ar:"{a} بيسأل: وصلت لفين في {item}؟", en:"{a} asks: where are you on {item}?"},
  request_new:    {ar:"{a} بعت طلب جديد: {item}", en:"{a} sent a new request: {item}"},
  assigned:       {ar:"بدأ الشغل على {item}", en:"Work started on {item}"},
  project_new:    {ar:"مشروع جديد: {item}", en:"New project: {item}"},
  member_added:   {ar:"اتضفت على مشروع {item}", en:"You were added to {item}"},
  task_new:       {ar:"مهمة جديدة: {item}", en:"New task: {item}"},
  task_stage:     {ar:"{a} وصل لـ {stage} في {item}", en:"{a} reached {stage} on {item}"},
  task_delivered: {ar:"{a} سلّم: {item}", en:"{a} delivered: {item}"},
  task_ping:      {ar:"Cammio بيسأل: وصلت لفين في {item}؟", en:"Cammio asks: where are you on {item}?"},
  checkin:        {ar:"{a} عمل تشييك ({n} تحديث)", en:"{a} checked in ({n} updates)"},
  admin_note:     {ar:"Cammio: {text}", en:"Cammio: {text}"},
};

export const TOURS = {
  admin: [
    ["nav-inbox", {ar:"هنا كل حاجة مستنياك: درافتات توافق عليها، طلبات جديدة، ردود الكلاينتس، والمتأخر.",en:"Everything waiting for you: drafts to approve, new requests, client replies, lates."}],
    ["nav-clients",{ar:"كل كلاينت لوحده: مشاريعه، فيديوهاته، وفلوسه.",en:"Each client: projects, videos and money."}],
    ["nav-team",{ar:"كل إديتور لوحده: شغله، اللي سلّمه، وسجلّه.",en:"Each editor: work, deliveries and record."}],
    ["bell",{ar:"دوس على أي إشعار يفتحلك الحاجة نفسها.",en:"Tap any notification to open the item."}],
  ],
  editor: [
    ["deliver",{ar:"خلصت حاجة؟ دوس هنا: اختار الفيديو، ارفع على Krock، والصق اللينك.",en:"Finished something? Pick the video, upload on Krock, paste the link."}],
    ["queue",{ar:"شغلك مترتب بالديدلاين. افتح أي فيديو تلاقي النوتس والخطوة الجاية.",en:"Your work by deadline. Open any video for its notes and next step."}],
    ["nav-record",{ar:"كل اللي سلّمته بسعره، والأحمر تأخير والأخضر بدري.",en:"Everything you delivered with its price; red late, green early."}],
    ["bell",{ar:"دوس على أي إشعار يفتحلك الحاجة نفسها.",en:"Tap any notification to open the item."}],
  ],
  client: [
    ["new",{ar:"ابدأ طلب جديد: لينك الدرايف وملاحظاتك.",en:"Start a request: Drive link and notes."}],
    ["projects",{ar:"كل فيديو ومرحلته لايف. افتح أي فيديو تضيف نوتس بالتايم كود أو تراجع الدرافت.",en:"Every video, live. Open one to add timecoded notes or review the draft."}],
    ["bell",{ar:"أول ما الدرافت يجهز هيوصلك إشعار هنا.",en:"You'll be notified here when a draft is ready."}],
  ],
};
