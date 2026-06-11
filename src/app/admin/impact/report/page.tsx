'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadImpact, ImpactData } from '@/lib/impact-data'
import { PAPER_BASELINE_SEC } from '@/lib/impact'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'

function Section({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="text-[13px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
        {no}. {title}
      </h2>
      <div className="text-[12px] text-gray-800 leading-relaxed space-y-1.5">{children}</div>
    </section>
  )
}

export default function ImpactReportPage() {
  const [data, setData] = useState<ImpactData | null>(null)

  useEffect(() => { loadImpact().then(setData) }, [])

  if (!data) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
  }

  const { counts, beforeAfter, speed, trends, coverage } = data
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-[210mm] mx-auto">
      {/* toolbar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between mb-4">
        <Link href="/admin/impact" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Impact Dashboard
        </Link>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
          <Printer size={14} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 print:border-0 rounded-2xl print:rounded-none px-8 py-8 print:px-0 print:py-0 space-y-5">
        {/* header */}
        <header className="text-center space-y-1 pb-2 border-b-2 border-gray-800">
          <p className="text-[11px] text-gray-500">ข้อเสนอโครงการนวัตกรรม · การประกวดนวัตกรรมการศึกษาเพื่อการพัฒนาประเทศ ครั้งที่ 2 ประจำปีการศึกษา 2569</p>
          <h1 className="text-lg font-extrabold text-gray-900">🚦 ไฟจราจรแห่งการเรียนรู้</h1>
          <p className="text-[13px] text-gray-700 font-medium">รู้จังหวะสอน รู้ใจเด็ก — แพลตฟอร์ม Data-Driven Smart Routine ฉบับโรงเรียนในเมืองอุตสาหกรรม</p>
          <p className="text-[11px] text-gray-500">โรงเรียนอนุสรณ์ศุภมาศ จ.สมุทรสาคร · ข้อมูล ณ {today} ({data.termName} สัปดาห์ที่ {data.currentWeek})</p>
        </header>

        <Section no={1} title="ชื่อผลงานนวัตกรรม / รายนามสมาชิกในทีม">
          <p><strong>ชื่อผลงาน:</strong> ไฟจราจรแห่งการเรียนรู้ : รู้จังหวะสอน รู้ใจเด็ก (ระบบ Suppamas Growth Engine)</p>
          <p className="text-gray-400">รายนามสมาชิกทีม (ไม่น้อยกว่า 5 คน): 1) ........................ 2) ........................ 3) ........................ 4) ........................ 5) ........................</p>
        </Section>

        <Section no={2} title="ประเภทลักษณะผลงานที่ส่งเข้าประกวด">
          <p>ด้านที่ 3 นวัตกรรมการศึกษาด้านการพัฒนาวิทยาศาสตร์และเทคโนโลยี — กิจกรรมพัฒนาสื่อและแพลตฟอร์มการเรียนรู้ดิจิทัล (Data Science เพื่อการศึกษา)</p>
        </Section>

        <Section no={3} title="ที่มาและความสำคัญ">
          <p>โรงเรียนอนุสรณ์ศุภมาศตั้งอยู่กลางเขตอุตสาหกรรม จ.สมุทรสาคร ผู้ปกครองส่วนใหญ่เป็นแรงงานโรงงานที่เข้ากะ ไม่มีเวลาติดตามการเรียนของลูกและกังวลเรื่องการอ่านออกเขียนได้ ขณะที่นักเรียนจำนวนมากมีภาวะสมาธิสั้น โรงเรียนมีพื้นที่จำกัด และครูแบกภาระงานเอกสารจนเวลาดูแลเด็กลดลง</p>
          <p>โรงเรียนจึงออกแบบ <strong>กิจวัตรการสอน 10-15-20-5</strong> (Hook–Core–Active–Exit Ticket) ให้เหมาะกับช่วงสมาธิของเด็ก และพัฒนาแพลตฟอร์มดิจิทัลที่เปลี่ยนข้อมูลในห้องเรียนเป็น "สัญญาณไฟจราจร" — ครูเห็นจังหวะการสอนของตนเอง ผู้บริหารเห็นห้องเรียนที่ต้องช่วยเหลือ และผู้ปกครองเห็นพัฒนาการของลูกผ่านมือถือทุกสัปดาห์ โดยไม่ใช้กระดาษเลย</p>
        </Section>

        <Section no={4} title="วัตถุประสงค์">
          <p>1) ลดภาระงานเอกสารครู — บันทึกผลการเรียน พฤติกรรมสมาธิ และทักษะสังคม ได้ภายใน 5 วินาทีต่อคน</p>
          <p>2) ไขว้ข้อมูลความเร็วการสอนของครูกับผลการเรียนรู้จริงของเด็ก (Cross-Tracking) เพื่อตรวจจับ "การเร่งสอนข้ามหัวเด็ก" (Speeding Hazard) แบบเรียลไทม์</p>
          <p>3) ลดความกังวลของผู้ปกครองกลุ่มแรงงานด้วยรายงานความสุขดิจิทัลรายสัปดาห์</p>
          <p>4) ติดตามความครอบคลุมตัวชี้วัด (ระหว่างทาง/ปลายทาง) ก่อนการสอบจริง</p>
        </Section>

        <Section no={5} title="กลุ่มเป้าหมาย">
          <p>นักเรียน {counts.students} คน ใน {counts.classrooms} ห้องเรียน · ครูผู้สอน {counts.teachers} คน · ผู้ปกครอง (ครอบครัวแรงงานอุตสาหกรรม) · ผู้บริหารสถานศึกษา — นำร่องระดับชั้น ป.3 และ ป.5 ก่อนขยายครบ 8 กลุ่มสาระการเรียนรู้</p>
        </Section>

        <Section no={6} title="กระบวนการพัฒนา / วิธีการดำเนินงาน">
          <p>แพลตฟอร์มประกอบด้วย 6 ระบบที่เชื่อมกันด้วยรหัสหน่วยการเรียนรู้:</p>
          <p>① <strong>โครงสร้างรายวิชา</strong> — ครูวิเคราะห์หลักสูตรจากคลังตัวชี้วัดกลาง จัดหน่วยการเรียนรู้รายสัปดาห์ ({counts.indicators} ตัวชี้วัด, {counts.modules} หน่วย)
            ② <strong>ส่งแผนและเช็คอินจังหวะสอน</strong> — แผนย่อ + สถานะ 3 สีทุกศุกร์ ({counts.plans + counts.pacingLogs} รายการ)
            ③ <strong>ประเมิน 3 มิติใน 5 วินาที</strong> — ดาววิชาการ + ไฟจราจรสมาธิ + ทักษะสังคม ({counts.assessments} รายการ)
            ④ <strong>การบ้านอัจฉริยะ</strong> — สแกน QR เช็คส่งงาน ({counts.homework} รายการ)
            ⑤ <strong>ศูนย์วิเคราะห์ไขว้</strong> — เมทริกซ์ Perfect Pacing / Speeding Hazard / Deep Learning / Critical Rescue + เตือนภัยล่วงหน้ารายบุคคล
            ⑥ <strong>รายงานผู้ปกครอง</strong> — การ์ดความสุขดิจิทัลส่งผ่าน LINE</p>
          <p>เทคโนโลยี: Next.js + Supabase + Cloudflare Pages (ไม่มีค่าลิขสิทธิ์) ใช้งานบนมือถือ/แท็บเล็ตของครูที่มีอยู่เดิม</p>
        </Section>

        <Section no={7} title="ผลการดำเนินงาน / ผลสัมฤทธิ์">
          <p>ข้อมูลสะสมจริงในระบบ: <strong>{counts.totalRecords.toLocaleString()} รายการดิจิทัล</strong> (แทนการจดกระดาษทั้งหมด) ครอบคลุม {trends.length} สัปดาห์การสอน</p>
          {trends.length > 0 && (
            <table className="w-full text-[11px] border border-gray-300 mt-1">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">สัปดาห์</th>
                  <th className="border border-gray-300 px-2 py-1">คะแนนเฉลี่ย (/2)</th>
                  <th className="border border-gray-300 px-2 py-1">สมาธิ 🟢 (%)</th>
                  <th className="border border-gray-300 px-2 py-1">ส่งงานตรงเวลา (%)</th>
                </tr>
              </thead>
              <tbody>
                {trends.map(t => (
                  <tr key={t.week}>
                    <td className="border border-gray-300 px-2 py-1">สัปดาห์ {t.week}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{t.avgScore ?? '—'}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{t.greenPct ?? '—'}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{t.onTimePct ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {coverage && (
            <p>ความครอบคลุมตัวชี้วัด: สอนแล้ว {coverage.covered}/{coverage.total} ตัว (ปลายทาง {coverage.finalCovered}/{coverage.finalTotal}) · ตรวจพบและแก้ไข Speeding Hazard {data.hazardCount} ครั้ง · บทเรียน Perfect Pacing {data.perfectCount} บท</p>
          )}
        </Section>

        <Section no={8} title="ผลกระทบ (Impact) — เปรียบเทียบก่อน–หลัง">
          {beforeAfter ? (
            <table className="w-full text-[11px] border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">ตัวชี้วัดผลกระทบ</th>
                  <th className="border border-gray-300 px-2 py-1">ก่อน ({beforeAfter.beforeLabel})</th>
                  <th className="border border-gray-300 px-2 py-1">หลัง ({beforeAfter.afterLabel})</th>
                  <th className="border border-gray-300 px-2 py-1">เปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {beforeAfter.rows.map(r => (
                  <tr key={r.metric}>
                    <td className="border border-gray-300 px-2 py-1">{r.metric}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{r.before ?? '—'}{r.before != null ? r.unit : ''}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{r.after ?? '—'}{r.after != null ? r.unit : ''}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {r.before != null && r.after != null ? `${r.after - r.before > 0 ? '+' : ''}${+(r.after - r.before).toFixed(2)}${r.unit}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-400">(ระบบจะสร้างตารางก่อน–หลังอัตโนมัติเมื่อมีข้อมูลตั้งแต่ 2 สัปดาห์ขึ้นไป)</p>
          )}
          <p>จุดเด่น: ข้อมูลทุกตัวในรายงานนี้ดึงจากการใช้งานจริง ไม่ใช่การประมาณการ — ระบบเปลี่ยน "ความรู้สึก" ของครูให้เป็น "หลักฐาน" ที่ผู้บริหารใช้ช่วยเหลือครูได้ระหว่างเทอม ก่อนเด็กจะสอบตกปลายภาค และผู้ปกครองที่ทำงานกะกลางคืนเห็นพัฒนาการลูกได้จากมือถือ</p>
        </Section>

        <Section no={9} title="งบประมาณ">
          <table className="w-full text-[11px] border border-gray-300">
            <tbody>
              <tr><td className="border border-gray-300 px-2 py-1">ฐานข้อมูลและระบบหลังบ้าน (Supabase Free Tier)</td><td className="border border-gray-300 px-2 py-1 text-right">0 บาท</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">โฮสติ้งเว็บแอป (Cloudflare Pages Free)</td><td className="border border-gray-300 px-2 py-1 text-right">0 บาท</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">อุปกรณ์ (มือถือ/แท็บเล็ตที่ครูมีอยู่เดิม)</td><td className="border border-gray-300 px-2 py-1 text-right">0 บาท</td></tr>
              <tr className="bg-gray-100 font-bold"><td className="border border-gray-300 px-2 py-1">รวมงบดำเนินการ</td><td className="border border-gray-300 px-2 py-1 text-right">0 บาท</td></tr>
            </tbody>
          </table>
        </Section>

        <Section no={10} title="ความคุ้มค่าของโครงการ">
          <p>• ความเร็วบันทึกข้อมูลวัดจริงจากระบบ: <strong>{speed.medianSec != null ? `${speed.medianSec} วินาที/รายการ` : 'อยู่ระหว่างเก็บข้อมูล'}</strong> เทียบงานกระดาษแบบเดิม ~{PAPER_BASELINE_SEC / 60} นาที/รายการ → ประหยัดเวลาครูสะสมแล้ว <strong>{speed.hoursSaved} ชั่วโมง</strong> คืนเวลาให้ครูอยู่กับเด็ก</p>
          <p>• เอกสารกระดาษที่ไม่ต้องผลิต: {counts.totalRecords.toLocaleString()} รายการ (แผนการสอน สมุดพกคะแนน บันทึกพฤติกรรม สมุดส่งงาน) — Paperless 100%</p>
          <p>• ขยายผลได้ทันทีด้วยงบ 0 บาท: สคริปต์ติดตั้งฐานข้อมูลชุดเดียว + คลังตัวชี้วัดกลาง ทำให้โรงเรียนอื่นหรือกลุ่มสาระอื่นเริ่มใช้ได้ในวันเดียว — ความยั่งยืนไม่ผูกกับงบประมาณหรือบริษัทเอกชน</p>
        </Section>

        <footer className="pt-3 border-t border-gray-300 text-[10px] text-gray-400 text-center">
          สร้างโดยระบบ Suppamas Growth Engine อัตโนมัติ · ข้อมูล ณ {today} · โรงเรียนอนุสรณ์ศุภมาศ จ.สมุทรสาคร
        </footer>
      </div>
    </div>
  )
}
