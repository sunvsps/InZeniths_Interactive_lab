/* Santa Box: Thai / English.
 * The pages are written in Thai. This file swaps every Thai text it knows for English (and back) without a reload:
 *  - static text and placeholder / aria-label / alt attributes,
 *  - text the page adds later (tiles, toasts, status lines), through a MutationObserver,
 *  - strings built from variables, through I18N.t('… {name} …', {name}).
 * Anything inside [data-no-i18n] (names, card message, coupon, engraving) is what people typed and is never translated.
 * Language: ?lang=en|th, else the saved choice, else the phone's language. */
window.I18N = (function () {
  var EN = {
    // ---- shared / header / footer
    'กล่องที่ 12,345': 'Box no. 12,345',
    'กล่องที่ {n}': 'Box no. {n}',
    'ส่งกันแล้ว {n} กล่อง': '{n} boxes sent so far',
    // shared Christmas tree page
    'ต้นคริสต์มาสของทุกคน': 'Everyone\'s Christmas tree',
    'ใต้ต้นนี้มี {n} กล่อง': '{n} boxes under this tree',
    'ใต้ต้นนี้มี 1 กล่อง': '1 box under this tree',
    'ยังไม่มีกล่องใต้ต้นนี้': 'No boxes under the tree yet',
    'โชว์แค่หน้าตากล่อง ไม่มีชื่อหรือข้อความ': 'Only the boxes\' looks are shown, never names or messages',
    'วางกล่องแรกใต้ต้นไม้ แล้วไฟบนต้นจะสว่างขึ้น': 'Place the first box and the tree lights up',
    '↻ ลากเพื่อหมุนรอบต้นไม้ · แตะกล่องเพื่อดูใกล้ๆ': '↻ Drag to walk around · tap a box for a closer look',
    'ห่อกล่องของคุณ': 'Wrap your box',
    'กล่อง{name} · โบว์{rib}': 'Box: {name} · Bow: {rib}',
    'ไม่มีของตกแต่ง': 'No decorations',
    'โหลดต้นคริสต์มาสไม่สำเร็จ': 'Couldn\'t load the tree',
    'ต้นคริสต์มาสสามมิติ มีกล่องของขวัญวางอยู่ใต้ต้น': '3D Christmas tree with gift boxes underneath',
    'กล่องของคุณอยู่ใต้ต้นคริสต์มาสรวมแล้ว': 'Your box is under the shared Christmas tree',
    'ดูต้นคริสต์มาส →': 'See the tree →',
    '© IN ZENITHS · มีปัญหาติดต่อ': '© IN ZENITHS · Need help? Contact',
    'ปิด': 'Close',
    'บาท': 'THB',
    'ฟรี': 'Free',
    'ดาวน์โหลดได้': 'Downloadable',
    'เสร็จแล้ว': 'Done',
    'ไม่บังคับ': 'optional',
    'เสียงอวยพร': 'Voice message',
    'คูปองสัญญา': 'Promise coupon',
    'คุณ': 'you',
    'เครื่องนี้แสดงภาพ 3D ไม่ได้': "This device can't show 3D",
    'เครื่องนี้แสดงภาพ 3D ไม่ได้ ลองเปิดด้วย Safari หรือ Chrome': "This device can't show 3D. Try Safari or Chrome.",
    'ห่อเสียงอวยพรใส่กล่อง ส่งให้คนที่คุณรัก': 'Wrap your voice in a gift box for someone you love',

    // ---- box design
    'ตัวอย่างกล่องของขวัญสามมิติ': '3D gift box preview',
    'กล่องของขวัญสามมิติ': '3D gift box',
    'ขั้นตอนห่อกล่อง': 'Wrapping steps',
    '↻ ลากเพื่อหมุนดู 360°': '↻ Drag to spin 360°',
    '↻ ลากที่กล่องเพื่อหมุนดู 360°': '↻ Drag the box to spin 360°',
    'กล่อง': 'Box',
    'การ์ด + เสียง': 'Card + voice',
    'ของในกล่อง': 'Gift',
    'เพลง': 'Music',
    'เลือกกล่อง': 'Choose your box',
    'ลากที่กล่องด้านบนเพื่อหมุนดูรอบด้าน': 'Drag the box above to see it from every side',
    'สีตัวกล่อง': 'Box colour',
    'ริบบิ้นและโบว์': 'Ribbon and bow',
    'ของประดับบนกล่อง': 'Decorations',
    'เลือกได้หลายอย่าง': 'Pick as many as you like',
    'ขาวหิมะ': 'Snow white', 'แดงคลาสสิก': 'Classic red', 'เขียวสน': 'Pine green', 'ทองอร่าม': 'Gold',
    'ขนมปังขิง': 'Gingerbread', 'กรมท่าคืนหนาว': 'Winter navy',
    'แดงซาติน': 'Red satin', 'ทองซาติน': 'Gold satin', 'แคนดี้เคน': 'Candy cane', 'ไหมมรกต': 'Emerald silk',
    'เลือกสีเอง': 'Pick a colour', 'สีที่เลือกเอง': 'Your own colour',
    'กำมะหยี่แดง': 'Red velvet', 'เงินประกาย': 'Silver sparkle',
    'กระดิ่ง': 'Bells', 'ลูกสน': 'Pine cones', 'ฮอลลี่': 'Holly', 'อบเชย': 'Cinnamon', 'ไฟกะพริบ': 'Fairy lights',

    // ---- card + voice
    'ออกแบบการ์ด': 'Design your card',
    'กระดาษการ์ด': 'Card paper',
    'ครีม': 'Cream', 'หิมะ': 'Snow', 'แดงทอง': 'Red & gold', 'คราฟท์': 'Kraft',
    'ตัวอักษร': 'Lettering',
    'แบบตัวอักษร': 'Lettering style',
    'ลายมือเรียบหรู': 'Classic', 'ลายมือสวย': 'Elegant script', 'ลายมือน่ารัก': 'Playful',
    'ถึง': 'To',
    'ถึง {name}': 'To {name}',
    'ชื่อผู้รับ': "Recipient's name",
    'เขียนถึงเขาสักหน่อย...': 'Write them a few words...',
    'ข้อความในการ์ด': 'Card message',
    'ชื่อคุณ': 'Your name here',
    'ชื่อผู้ส่ง': "Sender's name",
    'การ์ดข้อความ': 'Your card',
    'เสร็จ': 'Finish',
    'ไม่รู้จะเริ่มยังไง': 'Not sure where to start?',
    'แตะเพื่อเติมคำ': 'Tap to add a prompt',
    'ปีนี้ขอบคุณเรื่อง…': 'This year, thank you for…',
    'ปีหน้าอยากให้…': 'Next year, I hope…',
    'จำได้ไหมตอนที่…': 'Remember when…',
    'สิ่งที่ไม่เคยได้พูด…': "Something I've never said…",
    'ฟรี 15 วินาที · แพ็กเกจเสียเงิน 1 นาที': 'Free 15 s · paid plans 1 min',
    'เริ่มอัดเสียง': 'Start recording',
    'แตะเพื่อเริ่มอัด': 'Tap to record',
    'กำลังอัด…': 'Recording…',
    'อัดแล้ว แตะเพื่อฟัง': 'Recorded · tap to listen',
    'กำลังเล่น': 'Playing',
    'อัดใหม่': 'Record again',
    'ตัวอย่างนี้จำลองการอัด ยังไม่ได้ใช้ไมโครโฟนจริง': 'This preview simulates recording without a real microphone',
    'เกิน 15 วินาทีแล้ว ถ้าส่งฟรีจะได้แค่ 15 วินาทีแรก': 'Over 15 s: free boxes keep only the first 15 seconds',
    'เปิดไมค์ไม่ได้ ลองอนุญาตไมค์ในเบราว์เซอร์ หรือส่งแบบไม่มีเสียงก็ได้': "Can't use the microphone. Allow it in your browser, or send without a voice message.",

    // ---- gift
    'ใส่ของในกล่อง': 'Put a gift inside',
    'เลือกของขวัญได้ 1 ชิ้น ทุกกล่องมีคูปองกับรูปให้ด้วย': 'Pick 1 gift. Every box also has a coupon and a photo.',
    'ของขวัญ': 'Gift options',
    'ตุ๊กตาหมี': 'Teddy bear', 'ช็อกโกแลต': 'Chocolate', 'ลูกแก้วสลักชื่อ': 'Engraved ornament',
    'ลูกโลกหิมะ': 'Snow globe', 'ถุงเท้าคริสต์มาส': 'Christmas stocking',
    'สัญลักษณ์แห่งความอบอุ่นและความปลอดภัย - ช่วยปกป้องและมอบความอุ่นใจให้เจ้าของ': 'A symbol of warmth and safety - it watches over its owner and brings peace of mind',
    'สัญลักษณ์แห่งโชคดีและความรัก - ช่วยเสริมโชคลาภให้ได้พบคู่ครอง': 'A symbol of luck and love - it brings the good fortune of finding your match',
    'สัญลักษณ์แห่งความรักและความปรารถนาดี - ช่วยให้ความสัมพันธ์หวานชื่น': 'A symbol of love and good wishes - it keeps a relationship sweet',
    'สัญลักษณ์แห่งความทรงจำล้ำค่า - ช่วยเก็บช่วงเวลาดีๆ ของปีนี้ไว้ตลอดไป': "A symbol of precious memories - it keeps this year's best moments forever",
    'สัญลักษณ์แห่งความบริสุทธิ์และการเริ่มต้นใหม่ - ช่วยให้ปีใหม่เริ่มต้นอย่างสดใส': 'A symbol of purity and new beginnings - it starts the new year bright',
    'สัญลักษณ์แห่งการรอคอยสิ่งดีๆ - ช่วยเรียกโชคและของขวัญให้มาเต็มถุง': 'A symbol of waiting for good things - it calls luck and gifts to fill it up',
    'ข้อความสลัก เช่น ชื่อเขา · Christmas 2026': 'Engraving, e.g. their name · Christmas 2026',
    'ข้อความที่สลักบนลูกแก้ว': 'Text engraved on the ornament',
    'มีให้ทุกกล่อง': 'In every box',
    'สัญญาที่ผู้รับเอาไปแลกได้จริง แตะเพื่อเอาออก': 'A promise they can really redeem. Tap to remove.',
    'สัญญาว่าจะ… เช่น พาไปกินข้าวร้านโปรด 1 มื้อ': 'I promise to… e.g. take you to your favourite restaurant',
    'ข้อความคูปอง': 'Coupon text',
    'รูปความทรงจำ': 'Memory photo',
    'ไม่บังคับ ถ้าไม่ใส่รูป ผู้รับจะไม่เห็นช่องนี้': "Optional. Without a photo, they won't see this.",
    'เลือกรูป': 'Choose photo',
    'ยังไม่ได้เลือกรูป': 'No photo yet',

    // ---- music
    'เพลงตอนเปิดกล่อง': 'Music when they open it',
    'แตะเพื่อฟังตัวอย่าง เล่นเป็นเสียงกล่องดนตรี': 'Tap to preview. Plays like a music box.',
    'เพลงในรายการเป็นเพลงคริสต์มาสที่หมดลิขสิทธิ์แล้ว เพลงจะเบาลงอัตโนมัติตอนเสียงอวยพรเล่น': 'All songs are public-domain Christmas carols. Music fades down while your voice message plays.',
    'ซึ้ง ช้าๆ': 'Tender, slow', 'อบอุ่น ครอบครัว': 'Warm, for family', 'สนุก สดใส': 'Fun, bright',
    'ไม่ใส่เพลง': 'No music', 'ให้เสียงอวยพรเป็นพระเอก': 'Let your voice be the star',

    // ---- steps nav
    'ย้อนกลับ': 'Back',
    'ถัดไป': 'Next',
    'ถัดไป · {step}': 'Next · {step}',
    'ห่อเสร็จแล้ว': 'Wrap it up',
    'ต่อไป · ส่งให้ใคร': 'Next · who is it for?',

    // ---- delivery and price
    'ส่งกล่องให้': 'Send the box to',
    'ส่งธรรมดา': 'Standard',
    'ซานต้าใช้เวลาเดินทาง 25 ชม. · เปิดดูได้ 7 วัน': 'Santa takes 25 hours · open for 7 days',
    'ซานต้าใช้เวลาเดินทาง 25 ชม. · เปิดดูได้ 7 วัน · {voice}': 'Santa takes 25 hours · open for 7 days · {voice}',
    'เสียงจะเหลือ 15 วินาทีแรก (อัดไว้ {len})': 'voice cut to the first 15 s (recorded {len})',
    'เสียงอวยพร 15 วินาที': '15 s voice message',
    'ส่งด่วน · เก็บไว้ 1 ปี': 'Express · keep 1 year',
    'ถึงทันทีหรือตามเวลาที่ตั้ง · เสียงอวยพร 1 นาที · เปิดฟังได้ถึงคริสต์มาสหน้า': 'Arrives now or when you choose · 1 min voice · listen until next Christmas',
    'ส่งด่วน · เก็บไว้ตลอดไป': 'Express · keep forever',
    'เสียงอวยพร 1 นาที · ผู้รับดาวน์โหลดเสียงและการ์ดเก็บไว้ในเครื่องได้': '1 min voice · they can download the voice and card',
    'ให้กล่องถึงเมื่อไหร่': 'When should it arrive?',
    'ทันที': 'Now',
    'ตั้งเวลา': 'Schedule',
    'วันและเวลาที่ให้กล่องถึง': 'Arrival date and time',
    'เที่ยงคืนวันคริสต์มาส': 'Christmas midnight', 'เช้าวันคริสต์มาส 08:00': 'Christmas morning 08:00', 'เที่ยงคืนวันปีใหม่': "New Year's midnight",
    'จ่ายครั้งเดียว ไม่ใช่รายเดือน ไม่ตัดเงินซ้ำ': 'One-time payment. No subscription, no repeat charges.',
    'ดูแบบที่ผู้รับจะเห็น': 'Preview what they will see',
    'ส่งฟรี': 'Send for free',
    'ชำระ {n} บาท ด้วย PromptPay': 'Pay {n} THB with PromptPay',
    '{n} บาท': '{n} THB',
    'ส่งธรรมดา · ถึงใน 25 ชม.': 'Standard · arrives in 25 hours',

    // ---- "who is it for" sheet
    'ส่งให้ใคร?': 'Who is it for?',
    'ผู้รับจะเห็นชื่อตัวเองตอนเปิดลิงก์ และเห็นชื่อคุณบนการ์ด': 'They see their name when they open the link, and yours on the card',
    'ชื่อของคุณ': 'Your name',
    'ให้ผู้รับรู้ว่าใครส่งมา': 'So they know who it is from',
    'อีเมลของคุณ': 'Your email',
    'สำหรับใบเสร็จและกู้ลิงก์คืน': 'for your receipt and to recover the link',
    'ใส่อีเมลให้ถูกต้อง เพื่อรับใบเสร็จและกู้ลิงก์คืนได้': 'Enter a valid email for your receipt and link recovery',
    'เตือนก่อนคริสต์มาสปีหน้า': 'Remind me before next Christmas',
    'อีเมลฟรีล่วงหน้า 7 วัน ขอเลิกรับได้ที่ support@inzeniths.com': 'A free email 7 days ahead. To stop it, email support@inzeniths.com.',
    'การส่งกล่องถือว่าคุณรับทราบ': 'By sending this box you acknowledge our',
    'นโยบายความเป็นส่วนตัว': 'privacy notice',
    'ใส่เฉพาะรูปที่คุณมีสิทธิ์ใช้ และคนในรูปโอเคที่จะส่งให้ผู้รับ': 'Only add photos you have the right to use, and that the people in them are happy to share with the recipient.',
    'วางกล่องไว้ใต้ต้นคริสต์มาสรวม': 'Place my box under the shared Christmas tree',
    'โชว์แค่หน้าตากล่อง ไม่โชว์ชื่อ ข้อความ หรือเสียง': 'Only the box design is shown, never names, messages or voice',
    'โค้ดส่วนลด': 'Discount code',
    'ถ้ามี': 'if you have one',
    'ใช้โค้ด': 'Apply',
    'ตัวอย่าง: ยังไม่ได้เชื่อมระบบโค้ดส่วนลด': 'Preview: discount codes are not connected',
    'ใส่โค้ดก่อนกดใช้': 'Enter a code first',
    'ส่งเลย · ฟรีด้วยโค้ด': 'Send · free with your code',
    'ส่งธรรมดาฟรีอยู่แล้ว โค้ดใช้กับแบบ 25 / 125 บาท': 'Standard is already free. Codes work on the 25 / 125 THB plans.',
    'ใช้โค้ด {code} แล้ว · ฟรี': 'Code {code} applied · free',
    'ใช้โค้ด {code} แล้ว · ลด {n} บาท': 'Code {code} applied · {n} THB off',
    'โค้ดนี้ใช้ไม่ได้ หรือหมดอายุแล้ว': "This code doesn't work or has expired",
    'โค้ดนี้ใช้กับยอดที่สูงกว่านี้': 'This code needs a bigger order',
    'ใช้โค้ดนี้แล้วยอดต่ำกว่า 10 บาท ซึ่งชำระไม่ได้': 'With this code the total is under 10 THB, which cannot be charged',
    'รูปแบบโค้ดไม่ถูกต้อง': "That doesn't look like a code",
    'ตรวจโค้ดไม่สำเร็จ ลองใหม่อีกครั้ง': "Couldn't check the code. Please try again.",
    'ใส่ชื่อผู้รับก่อนนะ': "Add the recipient's name first",

    // ---- sending and sent screen
    'กำลังห่อกล่อง…': 'Wrapping your box…',
    'กำลังไปหน้าชำระเงิน…': 'Opening payment…',
    'กำลังยืนยันการชำระเงิน…': 'Confirming your payment…',
    'ตัวอย่าง: ข้ามหน้าชำระเงิน PromptPay': 'Preview: skipping the PromptPay payment',
    'ซานต้าออกเดินทางแล้ว · ถึง{to}ในอีก 25 ชม.': 'Santa is on his way · reaches {to} in 25 hours',
    'จะเด้งถึง{to} {when}': 'Arrives for {to} on {when}',
    'ถึง{to}แล้วตอนนี้': '{to} has it now',
    'ยกเลิกการชำระเงินแล้ว · กล่องจะเดินทางแบบธรรมดา ถึง{to}ในอีก 25 ชม.': 'Payment cancelled · the box travels standard and reaches {to} in 25 hours',
    'ยังไม่ได้รับยืนยันการชำระเงิน ถ้าจ่ายแล้วจะได้อีเมลยืนยัน': "Payment not confirmed yet. If you paid, you'll get an email.",
    'เวลาส่งต้องเป็นอนาคต และไม่เกิน 1 ปี': 'The arrival time must be in the future and within a year',
    'ไฟล์ใหญ่เกินไป': 'The file is too large',
    'ไฟล์ชนิดนี้ใช้ไม่ได้': "This file type isn't supported",
    'ข้อมูลบางอย่างไม่ถูกต้อง ลองตรวจอีกครั้ง': "Something isn't right. Please check and try again.",
    'ส่งถี่เกินไป รอสักครู่แล้วลองใหม่': 'Too many tries. Wait a moment and try again.',
    'ส่งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง': "Couldn't send. Check your connection and try again.",
    'แล้ว': '',
    'จะเด้งถึงแม่ 25 ธ.ค. เวลา 00:00': 'Arrives on 25 Dec at 00:00',
    'คัดลอก': 'Copy',
    'คัดลอกแล้ว': 'Copied',
    'เลือกข้อความแล้ว': 'Selected',
    'ลิงก์นี้เป็นตัวอย่าง ส่งให้ผู้รับทาง LINE หรือแชตไหนก็ได้': 'This is a sample link. Send it on LINE or any chat.',
    'ส่งลิงก์นี้ให้ผู้รับทาง LINE หรือแชตไหนก็ได้': 'Send this link to them on LINE or any chat',
    'แชร์ภาพทีเซอร์': 'Share teaser image',
    'ห่อกล่องใหม่': 'Wrap another box',
    'ดูตัวอย่างตอนผู้รับเปิดกล่อง': 'Preview how they open it',
    'อยากได้แคมเปญแบบ': 'Want a campaign like',
    'ให้แบรนด์คุณ?': 'for your brand?',
    'Santa Box เป็นแคมเปญของ IN ZENITHS เรารับทำ interactive experience เว็บไซต์ และระบบอีเวนต์': 'Santa Box is an IN ZENITHS campaign. We build interactive experiences, websites and event systems.',
    'ดูผลงาน': 'See our work',
    'คุยกับเรา': 'Talk to us',
    'ภาพทีเซอร์ 9:16': 'Teaser image 9:16',
    'ภาพทีเซอร์แนวตั้ง': 'Vertical teaser image',
    'ใส่ QR ในรูป': 'Add a QR code',
    'คนที่เห็นรูปนี้สแกนมาห่อกล่องของตัวเองได้': 'People who see this picture can scan it to wrap their own',
    'บันทึกรูปลงเครื่อง': 'Save image',
    'บันทึกรูปไม่สำเร็จ ลองกดค้างที่รูปแทน': "Couldn't save. Press and hold the image instead.",
    'ส่งกล่องให้{to}แล้ว': 'Sent to {to}',
    'ซานต้ากำลังเดินทาง ถึงในอีก 25 ชม.': 'Santa is on his way · arrives in 25 hours',
    'จะเด้งถึง {when}': 'Arrives {when}',
    'สแกนเพื่อห่อกล่องให้คนที่คุณรัก': 'Scan to wrap a box for someone you love',

    // ---- recipient
    'หน้ารอส่ง': 'Wait',
    'กำลังเปิดกล่อง…': 'Opening your box…',
    'ตัวอย่างที่ผู้รับจะเห็น': 'Preview: what they will see',
    'กลับไปแก้ไข': 'Back to editing',
    'ปิดตัวอย่าง': 'Close preview',
    'แตะที่ของขวัญเพื่อดูใกล้ๆ': 'Tap the gift for a closer look',
    'ลากเพื่อหมุน · บีบนิ้วหรือเลื่อนเพื่อซูม': 'Drag to turn · pinch or scroll to zoom',
    'ดูรูปความทรงจำ': 'View the memory photo',
    'กำลังตรวจสอบการชำระเงิน…': 'Checking your payment…',
    'ซานต้ากำลังเดินทาง': 'Santa is on his way',
    'มาหาคุณ': 'to you',
    'ชม.': 'hrs', 'นาที': 'min', 'วินาที': 'sec',
    'กล่องจาก': 'A box from',
    'จะถึงเวลา 00:00 คืนวันคริสต์มาส': 'arrives at midnight on Christmas Eve',
    'จะถึง {when}': 'arrives {when}',
    'ข้ามเวลา (ตัวอย่าง)': 'Skip ahead (preview)',
    'ตัวอย่าง': 'Sample',
    'จาก': 'From',
    'จาก {name}': 'From {name}',
    'เปิดกล่องของขวัญ': 'Open your gift',
    'แกะริบบิ้น': 'Untie the ribbon',
    'ลากขึ้นบนกล่องเพื่อดึงริบบิ้น หรือแตะกล่อง': 'Drag up on the box to pull the ribbon, or tap it',
    'ฟังเสียงอวยพร': 'Play voice message',
    'ตัวอย่างใช้เสียงสังเคราะห์ ในเว็บจริงเป็นเสียงที่ผู้ส่งอัดเอง': 'This preview uses a synthetic voice; real boxes play the sender\'s recording',
    'ดูของในกล่อง': "See what's inside",
    'สลักชื่อ “{text}”': 'Engraved “{text}”',
    'รูปความทรงจำจากผู้ส่ง': "The sender's memory photo",
    'แชร์รูปนี้': 'Share this',
    'เก็บไว้': 'Keep it',
    'ดาวน์โหลด': 'Download',
    'ส่งกล่องกลับให้ {name}': 'Send a box back to {name}',
    'ห่อกล่องให้คนที่คุณรักบ้าง': 'Wrap one for someone you love',
    'กล่องนี้เปิดดูได้อีก': 'This box stays open for',
    'กล่องนี้เก็บไว้': 'This box is kept',
    'ตลอดไป': 'forever',
    '{d} วัน {h} ชม.': '{d} days {h} hrs',
    '{h} ชม.': '{h} hrs',
    'เปิดอีกครั้ง': 'Open again',
    'ภาพสำหรับแชร์': 'Image to share',
    'ภาพแชร์แนวตั้ง 9:16': 'Vertical share image 9:16',
    'ใส่ข้อความในการ์ดด้วย': 'Include the card message',
    'เก็บเสียงและคำอวยพรนี้ไว้': 'Keep this voice and message',
    'จ่ายครั้งเดียว ไม่มีรายเดือน': 'One-time payment, no subscription',
    'เก็บไว้ 1 ปี': 'Keep 1 year',
    'เปิดฟังได้ถึงคริสต์มาสหน้า': 'Listen until next Christmas',
    'เก็บไว้ตลอดไป': 'Keep forever',
    'ดาวน์โหลดไฟล์เสียงและการ์ดเก็บไว้ในเครื่อง': 'Download the voice and card to your phone',
    'ชำระด้วย PromptPay · 125 บาท': 'Pay with PromptPay · 125 THB',
    'ชำระด้วย PromptPay · 100 บาท': 'Pay with PromptPay · 100 THB',
    'ชำระด้วย PromptPay · {n} บาท': 'Pay with PromptPay · {n} THB',
    'ไว้ทีหลัง': 'Maybe later',
    'ใครบางคน': 'Someone',
    'เล่นเสียงไม่ได้ ลองแตะอีกครั้ง': "Couldn't play the voice. Tap again.",
    'ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง': "Download failed. Please try again.",
    'หน้าตัวอย่าง ยังไม่ได้เชื่อมระบบชำระเงิน': 'Preview page: payments are not connected',
    'กล่องนี้เก็บไว้แล้ว': 'This box is already kept',
    'เริ่มชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง': "Couldn't start the payment. Please try again.",
    'ห่อกล่องให้คนที่คุณรัก': 'Wrap a box for someone you love',
    'ไม่พบกล่องนี้': "We can't find this box",
    'เปิดกล่องไม่ได้ตอนนี้': "Can't open the box right now",
    'ลิงก์อาจไม่ครบ ลองขอลิงก์จากผู้ส่งอีกครั้ง': 'The link may be cut off. Ask the sender for it again.',
    'ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง': 'Check your connection and try again.',
    'กล่องนี้หายไปแล้ว': 'This box has gone',
    'ห่อกล่องให้คนที่คุณรักบ้างไหม': 'Why not wrap one for someone you love?',
    'ขอบคุณ กำลังยืนยันการชำระเงิน…': 'Thank you! Confirming your payment…',
    'เก็บกล่องไว้ตลอดไปแล้ว ดาวน์โหลดได้ที่ปุ่มดาวน์โหลด': 'Kept forever. Use the Download button to save it.',
    'เก็บกล่องไว้ 1 ปีแล้ว': 'Kept for 1 year',
    'ยังไม่ได้รับยืนยันการชำระเงิน ถ้าจ่ายแล้วจะอัปเดตภายในไม่กี่นาที': 'Payment not confirmed yet. If you paid, it updates within a few minutes.',
    'เว็บจริงจะพาไปหน้าห่อกล่อง โดยใส่ "ลูกคนเล็ก" เป็นผู้รับไว้ให้แล้ว': 'The live site opens the wrapping page with the sender filled in as the recipient',
  };
  var MONTHS = {
    th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };
  // Reverse map for switching back. Every English text must be unique, or the way back would be ambiguous.
  var TH = {};
  Object.keys(EN).forEach(function (k) { if (EN[k] && k.indexOf('{') < 0) TH[EN[k]] = k; });

  function pick() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'th' || q === 'en') { localStorage.setItem('santaLang', q); return q; }
      var saved = localStorage.getItem('santaLang');
      if (saved === 'th' || saved === 'en') return saved;
    } catch (e) {}
    return /^th/i.test(navigator.language || '') ? 'th' : 'en';
  }
  var lang = pick();

  function fill(s, vars) { return s.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ''; }); }
  /** Translate a Thai source string (with {placeholders}) into the current language. */
  function t(th, vars) { return fill(lang === 'en' && EN[th] != null ? EN[th] : th, vars); }

  /** Swap one piece of text, keeping the spaces around it. */
  function swap(text) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text), core = m[2];
    if (!core) return null;
    var to = lang === 'en' ? EN[core] : TH[core];
    if (to == null || to === core || to.indexOf('{') >= 0) return null;
    return m[1] + to + m[3];
  }
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  // Text inside a textarea is what someone typed; its placeholder and label are ours, so attributes skip only [data-no-i18n].
  function skip(el) { return el && el.closest && el.closest('[data-no-i18n],script,style,textarea'); }
  function skipAttr(el) { return el && el.closest && el.closest('[data-no-i18n]'); }
  function apply(root) {
    root = root || document.body;
    if (root.nodeType === 3) { if (!skip(root.parentElement)) { var v = swap(root.nodeValue); if (v != null) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || skipAttr(root)) return;
    ATTRS.forEach(function (a) {
      root.querySelectorAll('[' + a + ']').forEach(function (el) { if (!skipAttr(el)) { var v = swap(el.getAttribute(a)); if (v != null) el.setAttribute(a, v); } });
      if (root.hasAttribute(a)) { var v2 = swap(root.getAttribute(a)); if (v2 != null) root.setAttribute(a, v2); }
    });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (node) { if (!skip(node.parentElement)) { var v = swap(node.nodeValue); if (v != null) node.nodeValue = v; } });
  }

  var hooks = [];
  function set(next) {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem('santaLang', lang); } catch (e) {}
    document.documentElement.lang = lang;
    apply(document.body);
    hooks.forEach(function (fn) { try { fn(lang); } catch (e) { console.error(e); } });
    syncButtons();
  }

  /** TH | EN switch: any element with [data-lang-switch] gets two buttons. */
  function syncButtons() {
    document.querySelectorAll('[data-lang-switch] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }
  function mountSwitch() {
    document.querySelectorAll('[data-lang-switch]').forEach(function (box) {
      box.innerHTML = '<button type="button" data-lang="th">TH</button><button type="button" data-lang="en">EN</button>';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Language');
      box.querySelectorAll('button').forEach(function (b) { b.onclick = function () { set(b.dataset.lang); }; });
    });
    syncButtons();
  }

  // Text the page adds or changes later gets translated as it appears.
  var busy = false;
  var obs = new MutationObserver(function (records) {
    if (busy || lang === 'th') return;
    busy = true;
    records.forEach(function (r) {
      if (r.type === 'characterData') apply(r.target);
      else if (r.type === 'attributes') apply(r.target);
      else r.addedNodes.forEach(function (n) { apply(n); });
    });
    busy = false;
  });

  function start() {
    document.documentElement.lang = lang;
    mountSwitch();
    if (lang === 'en') apply(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return {
    get lang() { return lang; },
    t: t,
    set: set,
    apply: apply,
    /** Run fn after every language switch (re-render text built from variables). */
    onChange: function (fn) { hooks.push(fn); },
    /** "25 ธ.ค. เวลา 00:00" or "25 Dec, 00:00" */
    date: function (v) {
      var d = new Date(v); if (isNaN(d)) return v;
      var hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
      return lang === 'en' ? d.getDate() + ' ' + MONTHS.en[d.getMonth()] + ', ' + hh + ':' + mm : d.getDate() + ' ' + MONTHS.th[d.getMonth()] + ' เวลา ' + hh + ':' + mm;
    },
  };
})();
