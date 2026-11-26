"""
Gera os baralhos de teste do importador do Anki (tests/fixtures/novo.apkg e antigo.apkg)
usando o próprio Anki (pacote Python oficial). Só para desenvolvimento.

Uso:
  python3 -m venv /tmp/venv-anki && /tmp/venv-anki/bin/pip install anki
  /tmp/venv-anki/bin/python ferramentas/criar_apkg_teste.py /tmp/anki-teste
  cp /tmp/anki-teste/novo.apkg /tmp/anki-teste/antigo.apkg tests/fixtures/

Conteúdo: pergunta simples com imagem, básico com inverso (um cartão estudado com
progresso FSRS e outro suspenso), omissão de palavras com dica, digitar a resposta,
oclusão de imagem nativa (retângulo, elipse e grupo) e oclusão do complemento
"Image Occlusion Enhanced" (máscaras SVG), em dois baralhos aninhados.
"""
import os, sys, struct, zlib
from anki.collection import Collection, ExportAnkiPackageOptions
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
col_path = os.path.join(out, 'teste.anki2')
pass
col = Collection(col_path)

# imagem PNG 200x100 (vermelho) gerada à mão
def png(w, h, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
img1 = os.path.join(out, 'coracao.png'); open(img1, 'wb').write(png(200, 100, (200, 60, 60)))
img2 = os.path.join(out, 'esquema.png'); open(img2, 'wb').write(png(300, 200, (60, 120, 200)))
n1 = col.media.add_file(img1); n2 = col.media.add_file(img2)

d_cor = col.decks.id('Medicina::Anatomia::Coração')
d_bio = col.decks.id('Medicina::Bioquímica')

basic = col.models.by_name('Basic')
n = col.new_note(basic); n['Front'] = f'Qual câmara está em vermelho?<br><img src="{n1}">'; n['Back'] = 'Ventrículo <b>esquerdo</b> &amp; parede espessa'; n.tags = ['anatomia', 'coracao']
col.add_note(n, d_cor)

rev = col.models.by_name('Basic (and reversed card)')
n = col.new_note(rev); n['Front'] = 'Glicólise'; n['Back'] = 'Via que quebra glicose em 2 piruvatos'
col.add_note(n, d_bio)

cloze = col.models.by_name('Cloze')
n = col.new_note(cloze); n['Text'] = 'A {{c1::glicólise}} acontece no {{c2::citosol::local}} e gera {{c1::2 ATP}}.'; n['Back Extra'] = 'Lehninger cap. 14'
col.add_note(n, d_bio)

# Oclusão de imagem nativa
io = col.models.by_name('Image Occlusion')
occ = ('{{c1::image-occlusion:rect:left=.1:top=.1:width=.3:height=.3:oi=1}}'
       '{{c2::image-occlusion:ellipse:left=.5:top=.2:rx=.1:ry=.15:oi=1}}'
       '{{c2::image-occlusion:rect:left=.6:top=.6:width=.2:height=.2:oi=1}}')
col.add_image_occlusion_note(notetype_id=io['id'], image_path=img2, occlusions=occ, header='Esquema do coração', back_extra='Netter prancha 210', tags=['io'])
col.set_deck(list(col.find_cards('note:"Image Occlusion"')), d_cor)

# Oclusão no formato do complemento "Image Occlusion Enhanced" (máscaras SVG)
mm = col.models
ioe = mm.new('Image Occlusion Enhanced')
for nome in ['ID (hidden)', 'Header', 'Image', 'Question Mask', 'Footer', 'Remarks', 'Sources', 'Extra 1', 'Extra 2', 'Answer Mask', 'Original Mask']:
    mm.add_field(ioe, mm.new_field(nome))
t = mm.new_template('IO Card')
t['qfmt'] = '{{#Image}}<div id="io-header">{{Header}}</div><div id="io-wrapper"><div id="io-overlay">{{Question Mask}}</div><div id="io-original">{{Image}}</div></div>{{/Image}}'
t['afmt'] = '{{#Image}}<div id="io-header">{{Header}}</div><div id="io-wrapper"><div id="io-overlay">{{Answer Mask}}</div><div id="io-original">{{Image}}</div></div>{{/Image}}<div id="io-footer">{{Footer}}</div><div>{{Remarks}}</div>'
mm.add_template(ioe, t)
mm.add(ioe)
svgq = os.path.join(out, 'mask-Q.svg'); open(svgq, 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect x="30" y="30" width="90" height="60" fill="#FF7E7E" stroke="#2D2D2D"/></svg>')
svga = os.path.join(out, 'mask-A.svg'); open(svga, 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"></svg>')
q = col.media.add_file(svgq); a = col.media.add_file(svga)
n = col.new_note(mm.by_name('Image Occlusion Enhanced'))
n['ID (hidden)'] = 'abc-1'; n['Header'] = 'Átrio direito?'; n['Image'] = f'<img src="{n2}">'; n['Question Mask'] = f'<img src="{q}">'; n['Answer Mask'] = f'<img src="{a}">'; n['Remarks'] = 'Ver https://exemplo.com/atlas'
col.add_note(n, d_cor)

# Digitar a resposta, com HTML variado
tipo = col.models.by_name('Basic (type in the answer)')
n = col.new_note(tipo); n['Front'] = '<div>Valva entre AE&nbsp;e VE?</div><ul><li>uma</li><li>palavra</li></ul>'; n['Back'] = 'Mitral'
col.add_note(n, d_cor)

# Um cartão já estudado (progresso FSRS) e um suspenso
from anki.cards import FSRSMemoryState
cid = col.find_cards('"Glicólise" note:"Basic (and reversed card)" card:1')[0]
c = col.get_card(cid)
c.type = 2; c.queue = 2; c.ivl = 12; c.due = col.sched.today + 5; c.reps = 4; c.lapses = 1; c.factor = 2300
c.memory_state = FSRSMemoryState(stability=14.5, difficulty=6.2)
col.update_card(c)
sus = col.find_cards('"Glicólise" note:"Basic (and reversed card)" card:2')[0]
col.sched.suspend_cards([sus])

print('notas', col.note_count(), 'cartões', col.card_count(), 'hoje', col.sched.today)
for legacy, nome in [(False, 'novo.apkg'), (True, 'antigo.apkg')]:
    col.export_anki_package(out_path=os.path.join(out, nome), options=ExportAnkiPackageOptions(with_scheduling=True, with_deck_configs=False, with_media=True, legacy=legacy), limit=None)
col.close()
print(sorted(os.listdir(out)))
