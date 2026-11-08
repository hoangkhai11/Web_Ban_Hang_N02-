export const formatVND = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ'

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

/** Đọc nhóm 3 chữ số; full = true với nhóm không đứng đầu (VD: "không trăm lẻ năm"). */
function read3(n: number, full: boolean) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10
  const out: string[] = []
  if (full || h > 0) out.push(DIGITS[h], 'trăm')
  if (t > 1) {
    out.push(DIGITS[t], 'mươi')
    if (u === 1) out.push('mốt')
    else if (u === 4) out.push('tư')
    else if (u === 5) out.push('lăm')
    else if (u > 0) out.push(DIGITS[u])
  } else if (t === 1) {
    out.push('mười')
    if (u === 5) out.push('lăm')
    else if (u > 0) out.push(DIGITS[u])
  } else if (u > 0) {
    if (out.length) out.push('lẻ')
    out.push(DIGITS[u])
  }
  return out.join(' ')
}

/** Số tiền bằng chữ cho hóa đơn: 12198000 → "Mười hai triệu một trăm chín mươi tám nghìn đồng" */
export function readVND(value: number) {
  let n = Math.round(Math.abs(value))
  if (n === 0) return 'Không đồng'
  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    parts.push(read3(groups[i], i < groups.length - 1), units[i])
  }
  const s = parts.filter(Boolean).join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng'
}

export const classNames =(...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')
