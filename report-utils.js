'use strict';

(function exposeReports(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SomatraReports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createReportsApi() {
  const encoder = new TextEncoder();
  const FINANCIAL = /[€$£]|\b(?:chf|francs?|prix|tarifs?|montants?|factures?|facturations?|chiffre d.affaires|co[uû]ts?|valeurs?)\b/iu;

  function clean(value, limit = 120) {
    const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (FINANCIAL.test(text)) return 'Information retirée';
    return [...text].slice(0, limit).join('') || 'Non renseigné';
  }

  function slug(value) {
    return clean(value, 80).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'client';
  }

  function byteString(value) {
    return Uint8Array.from([...value].map((character) => {
      const code = character.codePointAt(0);
      return code <= 255 ? code : 63;
    }));
  }

  function pdfEscape(value) {
    return clean(value, 160).replace(/([\\()])/g, '\\$1');
  }

  function text(value, x, y, size = 8, bold = false) {
    return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
  }

  function rect(x, y, width, height, gray = 0.96) {
    return `q ${gray} g ${x} ${y} ${width} ${height} re f Q`;
  }

  function createPdfDocument(commands) {
    const objects = new Map();
    const pageIds = commands.map((_, index) => 6 + index * 2);
    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${commands.length} >>`);
    objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    commands.forEach((stream, index) => {
      const contentId = 5 + index * 2;
      objects.set(contentId, `<< /Length ${byteString(stream).length} >>\nstream\n${stream}\nendstream`);
      objects.set(contentId + 1, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    const chunks = [byteString('%PDF-1.4\n%âãÏÓ\n')];
    const offsets = [0];
    let length = chunks[0].length;
    const count = 4 + commands.length * 2;
    for (let id = 1; id <= count; id += 1) {
      offsets[id] = length;
      const chunk = byteString(`${id} 0 obj\n${objects.get(id)}\nendobj\n`);
      chunks.push(chunk);
      length += chunk.length;
    }
    const xrefOffset = length;
    chunks.push(byteString(`xref\n0 ${count + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(total);
    let cursor = 0;
    chunks.forEach((chunk) => { bytes.set(chunk, cursor); cursor += chunk.length; });
    return bytes;
  }

  function monthLabel(month) {
    const [year, number] = month.split('-').map(Number);
    const label = new Intl.DateTimeFormat('fr-FR', {month:'long', year:'numeric'}).format(new Date(year, number - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function createClientPdf(entries, month, client) {
    if (!entries.length) throw new Error('Un relevé vide ne peut pas être généré.');
    const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
    const pages = [];
    for (let offset = 0; offset < sorted.length; offset += 24) {
      const rows = sorted.slice(offset, offset + 24);
      const commands = [
        rect(35, 755, 525, 60, 0.88),
        text('SOMATRA - RELEVE D ACTIVITE', 50, 790, 15, true),
        text(`Client : ${clean(client)}`, 50, 770, 11, true),
        text(`Mois : ${monthLabel(month)}`, 350, 770, 10, true),
        rect(35, 720, 525, 26, 0.82),
        text('Date', 43, 730, 8, true), text('Département', 100, 730, 8, true),
        text('Activité', 215, 730, 8, true), text('Nom', 365, 730, 8, true), text('Temps', 505, 730, 8, true)
      ];
      let y = 700;
      rows.forEach((entry, index) => {
        if (index % 2) commands.push(rect(35, y - 8, 525, 24, 0.96));
        commands.push(text(clean(entry.date, 10), 43, y, 7));
        commands.push(text(clean(entry.department, 24), 100, y, 7));
        commands.push(text(clean(entry.activity, 31), 215, y, 7));
        commands.push(text(clean(entry.operator, 29), 365, y, 7));
        commands.push(text(`${Number(entry.minutes) || 0} min`, 505, y, 7, true));
        y -= 26;
      });
      const totalMinutes = sorted.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
      if (offset + rows.length === sorted.length) {
        commands.push(rect(365, Math.max(45, y - 3), 195, 30, 0.82));
        commands.push(text(`TOTAL : ${totalMinutes} minutes`, 390, Math.max(56, y + 7), 10, true));
      }
      commands.push(text(`Page ${pages.length + 1}`, 510, 28, 7));
      pages.push(commands.join('\n'));
    }
    return createPdfDocument(pages);
  }

  const crcTable = Array.from({length:256}, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
    return (crc ^ 0xffffffff) >>> 0;
  }

  function little(value, size) {
    const bytes = new Uint8Array(size);
    for (let index = 0; index < size; index += 1) bytes[index] = (value >>> (index * 8)) & 0xff;
    return bytes;
  }

  function join(chunks) {
    const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }

  function createZip(files) {
    if (!files.length) throw new Error('Une archive vide ne peut pas être générée.');
    const local = [];
    const central = [];
    let offset = 0;
    files.forEach(({name, bytes}) => {
      const filename = encoder.encode(name);
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const crc = crc32(data);
      const localHeader = join([little(0x04034b50, 4), little(20, 2), little(0x0800, 2), little(0, 2), little(0, 2), little(0, 2), little(crc, 4), little(data.length, 4), little(data.length, 4), little(filename.length, 2), little(0, 2), filename]);
      local.push(localHeader, data);
      central.push(join([little(0x02014b50, 4), little(20, 2), little(20, 2), little(0x0800, 2), little(0, 2), little(0, 2), little(0, 2), little(crc, 4), little(data.length, 4), little(data.length, 4), little(filename.length, 2), little(0, 2), little(0, 2), little(0, 2), little(0, 2), little(0, 4), little(offset, 4), filename]));
      offset += localHeader.length + data.length;
    });
    const centralBytes = join(central);
    return join([...local, centralBytes, join([little(0x06054b50, 4), little(0, 2), little(0, 2), little(files.length, 2), little(files.length, 2), little(centralBytes.length, 4), little(offset, 4), little(0, 2)])]);
  }

  function prepareArtifact(entries, month, selectedClient = 'all') {
    const groups = new Map();
    entries.forEach((entry) => {
      if (!groups.has(entry.client)) groups.set(entry.client, []);
      groups.get(entry.client).push(entry);
    });
    const clients = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
    if (!clients.length) throw new Error('Aucune saisie à inclure.');
    if (selectedClient !== 'all' && !groups.has(selectedClient)) throw new Error('Le client sélectionné ne contient aucune saisie.');
    const scope = selectedClient === 'all' ? clients : [selectedClient];
    const usedNames = new Set();
    const files = scope.map((client) => {
      const base = `somatra-releve-${month}-${slug(client)}`;
      let filename = `${base}.pdf`;
      let suffix = 2;
      while (usedNames.has(filename)) filename = `${base}-${suffix++}.pdf`;
      usedNames.add(filename);
      return {name:filename, bytes:createClientPdf(groups.get(client), month, client)};
    });
    const isZip = selectedClient === 'all';
    const bytes = isZip ? createZip(files) : files[0].bytes;
    return Object.freeze({bytes, files:Object.freeze(files), filename:isZip ? `somatra-releves-${month}.zip` : files[0].name, mime:isZip ? 'application/zip' : 'application/pdf', format:isZip ? 'ZIP' : 'PDF', client:selectedClient, month, pdfCount:files.length});
  }

  return {clean, slug, crc32, createClientPdf, createZip, prepareArtifact};
}));