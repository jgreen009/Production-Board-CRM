export interface PrintSizePreset {
  label: string
  widthMm: number
  heightMm: number
}

// Standard paper sizes used for print dimensions, plus an "Oversize" preset
// for anything bigger than A3. Selecting one sets width+height together;
// there's no free-entry width/height field on this form.
export const PRINT_SIZES: PrintSizePreset[] = [
  { label: 'A5', widthMm: 148, heightMm: 210 },
  { label: 'A6', widthMm: 105, heightMm: 148 },
  { label: 'A4', widthMm: 210, heightMm: 297 },
  { label: 'A3', widthMm: 297, heightMm: 420 },
  { label: 'Oversize', widthMm: 400, heightMm: 500 },
]
