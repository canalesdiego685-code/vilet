import type { InventoryItem, InventoryMovement } from '../types'

function numberValue(value: number | string | null | undefined) {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function hasRecord(item: InventoryItem) {
  return item.tiene_registro === true || Number(item.tiene_registro) === 1
}

function xml(value: string | number) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function cell(reference: string, value: string | number, style: number) {
  const stylePart = ' s="' + style + '"'
  if (typeof value === 'number' && Number.isFinite(value)) {
    return '<c r="' + reference + '"' + stylePart + '><v>' + String(value) + '</v></c>'
  }
  return '<c r="' + reference + '"' + stylePart + ' t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>'
}

function row(number: number, cells: string[], height?: number) {
  return '<row r="' + number + '"' + (height ? ' ht="' + height + '" customHeight="1"' : '') + '>' + cells.join('') + '</row>'
}

function columnName(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-MX')
}

function columnCells(rowNumber: number, values: Array<string | number>, styleForColumn: (column: number) => number) {
  return values.map((value, index) => cell(columnName(index) + rowNumber, value, styleForColumn(index)))
}

function xmlHeader() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
}

function createInventorySheet(items: InventoryItem[]) {
  const rows: string[] = []
  rows.push(row(1, [cell('A1', 'VILET  |  INVENTARIO ACTUAL', 1)], 34))
  rows.push(row(2, [cell('A2', 'Existencias de productos · Generado el ' + new Date().toLocaleString('es-MX'), 2)], 23))
  rows.push(row(3, []))
  const headings = ['PRODUCTO', 'UNIDAD', 'PIEZAS', 'KILOGRAMOS', 'ENTRADAS PZ', 'SALIDAS PZ', 'ENTRADAS KG', 'SALIDAS KG', 'ACTUALIZADO']
  rows.push(row(4, columnCells(4, headings, () => 3), 25))
  items.forEach((item, index) => {
    const rowNumber = index + 5
    const zebra = index % 2 === 1
    const strings = [item.nombre, item.unidad, formatDate(item.fecha_actualizacion)]
    const values: Array<string | number> = [
      strings[0],
      strings[1],
      numberValue(item.stock_piezas),
      numberValue(item.stock_kg),
      numberValue(item.entradas_piezas),
      numberValue(item.salidas_piezas),
      numberValue(item.entradas_kg),
      numberValue(item.salidas_kg),
      strings[2],
    ]
    rows.push(row(rowNumber, columnCells(rowNumber, values, (column) => {
      if (column === 0 || column === 1 || column === 8) return zebra ? 6 : 4
      return zebra ? 7 : 5
    })))
  })
  const totalRowNumber = items.length + 5
  const totals = [
    'TOTAL DE EXISTENCIAS',
    '',
    items.reduce((sum, item) => sum + numberValue(item.stock_piezas), 0),
    items.reduce((sum, item) => sum + numberValue(item.stock_kg), 0),
    items.reduce((sum, item) => sum + numberValue(item.entradas_piezas), 0),
    items.reduce((sum, item) => sum + numberValue(item.salidas_piezas), 0),
    items.reduce((sum, item) => sum + numberValue(item.entradas_kg), 0),
    items.reduce((sum, item) => sum + numberValue(item.salidas_kg), 0),
    '',
  ]
  rows.push(row(totalRowNumber, columnCells(totalRowNumber, totals, (column) => column >= 2 && column <= 7 ? 9 : 8), 25))

  const lastRow = String(totalRowNumber)
  const filterLastRow = String(Math.max(4, items.length + 4))
  const body = xmlHeader() +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:I' + lastRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="21"/>' +
    '<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="8" width="15" customWidth="1"/><col min="9" max="9" width="19" customWidth="1"/></cols>' +
    '<sheetData>' + rows.join('') + '</sheetData>' +
    '<mergeCells count="2"><mergeCell ref="A1:I1"/><mergeCell ref="A2:I2"/></mergeCells>' +
    '<autoFilter ref="A4:I' + filterLastRow + '"/>' +
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  return body
}

function createSummarySheet(items: InventoryItem[]) {
  const withStock = items.filter(hasRecord).length
  const values: Array<[string, number | string]> = [
    ['Productos en catálogo', items.length],
    ['Productos con existencias registradas', withStock],
    ['Productos sin registro (se muestran en cero)', items.length - withStock],
    ['Existencias totales en piezas', items.reduce((sum, item) => sum + numberValue(item.stock_piezas), 0)],
    ['Existencias totales en kilogramos', items.reduce((sum, item) => sum + numberValue(item.stock_kg), 0)],
    ['Entradas en piezas', items.reduce((sum, item) => sum + numberValue(item.entradas_piezas), 0)],
    ['Salidas en piezas', items.reduce((sum, item) => sum + numberValue(item.salidas_piezas), 0)],
    ['Entradas en kilogramos', items.reduce((sum, item) => sum + numberValue(item.entradas_kg), 0)],
    ['Salidas en kilogramos', items.reduce((sum, item) => sum + numberValue(item.salidas_kg), 0)],
  ]
  const rows: string[] = [
    row(1, [cell('A1', 'VILET  |  RESUMEN DE INVENTARIO', 1)], 34),
    row(2, [cell('A2', 'Cifras consultadas desde MySQL · ' + new Date().toLocaleString('es-MX'), 2)], 23),
    row(3, []),
    row(4, [cell('A4', 'INDICADOR', 3), cell('B4', 'VALOR', 3)], 25),
  ]
  values.forEach(([label, value], index) => {
    const rowNumber = index + 5
    const style = index % 2 === 0 ? 4 : 6
    const valueStyle = index % 2 === 0 ? 5 : 7
    rows.push(row(rowNumber, [cell('A' + rowNumber, label, style), cell('B' + rowNumber, value, valueStyle)]))
  })
  rows.push(row(values.length + 6, [cell('A' + (values.length + 6), 'Los productos sin fila en inventario aparecen con cantidad cero.', 2)], 24))
  const lastRow = String(values.length + 6)
  return xmlHeader() +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:B' + lastRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="23"/>' +
    '<cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/></cols>' +
    '<sheetData>' + rows.join('') + '</sheetData>' +
    '<mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>' +
    '<pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.2" footer="0.2"/>' +
    '</worksheet>'
}

function createMovementsSheet(movements: InventoryMovement[]) {
  const rows: string[] = [
    row(1, [cell('A1', 'VILET  |  HISTORIAL DE INVENTARIO', 1)], 34),
    row(2, [cell('A2', 'Entradas y salidas · Generado el ' + new Date().toLocaleString('es-MX'), 2)], 23),
    row(3, []),
    row(4, columnCells(4, ['FECHA', 'TIPO', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'USUARIO', 'DETALLE'], () => 3), 25),
  ]
  movements.forEach((movement, index) => {
    const rowNumber = index + 5
    const zebra = index % 2 === 1
    const values: Array<string | number> = [
      movement.fecha,
      movement.tipo_movimiento.toUpperCase(),
      movement.producto,
      movement.unidad ?? movement.presentacion ?? '',
      numberValue(movement.cantidad),
      movement.usuario ?? '',
      [movement.motivo, movement.cliente].filter(Boolean).join(' · '),
    ]
    rows.push(row(rowNumber, columnCells(rowNumber, values, (column) => {
      if (column === 4) return zebra ? 7 : 5
      return zebra ? 6 : 4
    })))
  })
  const lastRow = String(Math.max(4, movements.length + 4))
  return xmlHeader() +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:G' + lastRow + '"/>' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="21"/>' +
    '<cols><col min="1" max="1" width="21" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="4" width="11" customWidth="1"/><col min="5" max="5" width="13" customWidth="1"/><col min="6" max="6" width="18" customWidth="1"/><col min="7" max="7" width="35" customWidth="1"/></cols>' +
    '<sheetData>' + rows.join('') + '</sheetData>' +
    '<mergeCells count="2"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/></mergeCells>' +
    '<autoFilter ref="A4:G' + lastRow + '"/>' +
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
}

const encoder = new TextEncoder()
const crcTable = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  crcTable[index] = value >>> 0
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function put16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function put32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concatenate(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function zipStore(files: Array<[string, string]>) {
  const localParts: Uint8Array[] = []
  const directoryParts: Uint8Array[] = []
  let localOffset = 0
  for (const [fileName, contents] of files) {
    const nameBytes = encoder.encode(fileName)
    const dataBytes = encoder.encode(contents)
    const checksum = crc32(dataBytes)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    put32(localView, 0, 0x04034b50)
    put16(localView, 4, 20)
    put16(localView, 6, 0)
    put16(localView, 8, 0)
    put16(localView, 10, 0)
    put16(localView, 12, 33)
    put32(localView, 14, checksum)
    put32(localView, 18, dataBytes.length)
    put32(localView, 22, dataBytes.length)
    put16(localView, 26, nameBytes.length)
    put16(localView, 28, 0)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, dataBytes)

    const directoryHeader = new Uint8Array(46 + nameBytes.length)
    const directoryView = new DataView(directoryHeader.buffer)
    put32(directoryView, 0, 0x02014b50)
    put16(directoryView, 4, 20)
    put16(directoryView, 6, 20)
    put16(directoryView, 8, 0)
    put16(directoryView, 10, 0)
    put16(directoryView, 12, 0)
    put16(directoryView, 14, 33)
    put32(directoryView, 16, checksum)
    put32(directoryView, 20, dataBytes.length)
    put32(directoryView, 24, dataBytes.length)
    put16(directoryView, 28, nameBytes.length)
    put16(directoryView, 30, 0)
    put16(directoryView, 32, 0)
    put16(directoryView, 34, 0)
    put16(directoryView, 36, 0)
    put32(directoryView, 38, 0)
    put32(directoryView, 42, localOffset)
    directoryHeader.set(nameBytes, 46)
    directoryParts.push(directoryHeader)
    localOffset += localHeader.length + dataBytes.length
  }
  const directory = concatenate(directoryParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  put32(endView, 0, 0x06054b50)
  put16(endView, 4, 0)
  put16(endView, 6, 0)
  put16(endView, 8, files.length)
  put16(endView, 10, files.length)
  put32(endView, 12, directory.length)
  put32(endView, 16, localOffset)
  put16(endView, 20, 0)
  return concatenate([...localParts, directory, end])
}

export function downloadInventoryWorkbook(items: InventoryItem[], movements: InventoryMovement[]) {
  const workbook = xmlHeader() +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/><sheet name="Resumen" sheetId="2" r:id="rId2"/><sheet name="Movimientos" sheetId="3" r:id="rId3"/></sheets></workbook>'
  const relationships = xmlHeader() +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  const rootRelationships = xmlHeader() +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
  const contentTypes = xmlHeader() +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
  const styles = xmlHeader() +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><sz val="10"/><color rgb="FFD8E1EC"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142B49"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2867C9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF1F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD7E0EB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="4" fillId="2" borderId="0" xfId="0"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  const now = new Date().toISOString()
  const core = xmlHeader() + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Vilet</dc:creator><cp:lastModifiedBy>Vilet</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>'
  const app = xmlHeader() + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Vilet</Application><TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>Inventario</vt:lpstr><vt:lpstr>Resumen</vt:lpstr><vt:lpstr>Movimientos</vt:lpstr></vt:vector></TitlesOfParts></Properties>'
  const bytes = zipStore([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRelationships],
    ['docProps/app.xml', app],
    ['docProps/core.xml', core],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', relationships],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', createInventorySheet(items)],
    ['xl/worksheets/sheet2.xml', createSummarySheet(items)],
    ['xl/worksheets/sheet3.xml', createMovementsSheet(movements)],
  ])
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'inventario-vilet-' + new Date().toISOString().slice(0, 10) + '.xlsx'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}