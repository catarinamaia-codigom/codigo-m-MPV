#!/usr/bin/env python3
"""
Importa o horário do Módulo Morfofuncional I (PDF da coordenação) para as
abas Aulas, Avaliacoes e Feriados de data/simulacao.json.

Uso:  python3 ferramentas/importar_horario.py caminho/do/horario.pdf [data/simulacao.json]
Requer: pip install pdfplumber

O PDF tem algumas células quebradas ou desalinhadas; os dias problemáticos
são corrigidos à mão em CORRECOES (no fim do arquivo). Tudo o que foi
interpretado/corrigido aparece no relatório impresso ao final.
"""
import json
import re
import sys
import unicodedata

import pdfplumber

ANO = 2026
CADEIRAS = {
    'citologia': 'citologia', 'histologia': 'histologia', 'anatomia': 'anatomia',
    'bioquimica': 'bioquimica', 'biofisica': 'biofisica', 'fisiologia': 'fisiologia',
    'genetica': 'genetica', 'todas': 'morfo1',
}
MODULOS_FIXOS = {  # blocos de outros módulos que aparecem no horário
    'IM': ('mdm', 'Identidade Médica'), 'ID': ('mdm', 'Identidade Médica'),
    'IP': ('interprofissional', 'Interprofissional'), 'APS': ('aps', 'APS'),
}
TYPOS = {
    'Viscerocrãnio': 'Viscerocrânio', 'cartilagnioso': 'cartilaginoso', 'Crstina': 'Cristina',
    'Crisrina': 'Cristina', 'Suta ': 'Sura ', 'Priscila/Cristina': 'Priscilla/Cristina',
}
IGNORAR = {'ÁREA VERDE', 'AREA VERDE', 'LIVRE', 'IMPRENSADO', ''}
relatorio = []


def sem_acento(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()


def limpar(s):
    s = (s or '').replace(' | ', ' ').replace('\n', ' ').strip()
    for a, b in TYPOS.items():
        s = s.replace(a, b)
    s = re.sub(r'^TE:\s*', '', s)
    s = re.sub(r'\*$', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def vazio(s):
    return limpar(s) in ('', '-')


def ler_linhas(pdf_path):
    linhas = []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in pdf.pages:
            for tabela in pagina.extract_tables():
                for r in tabela:
                    r = [c or '' for c in r]
                    if len(r) > 7:  # algumas páginas têm colunas vazias extras
                        r = r[:3] + r[-4:]
                    if len(r) == 7:
                        linhas.append(r)
    return linhas


def turma_de(tipo, tema):
    """Extrai turma (TA, TA1/TA2, TB…) do campo Teórica/Prática ou do tema."""
    m = re.search(r'\((T[AB]\d?(?:/\s*T[AB]\d?)*)\)', tema)
    texto = tipo + ' ' + (m.group(1) if m else '')
    turmas = sorted(set(re.findall(r'T[ABC]\d?', texto.replace(' ', ''))))
    if not turmas or 'TC' in turmas:
        return 'Todas'
    if any(t.startswith('TA') for t in turmas) and any(t.startswith('TB') for t in turmas):
        return 'Todas'
    return '/'.join(turmas)


def tipo_aula(tipo):
    t = sem_acento(tipo)
    if 'caso' in t:
        return 'Caso clínico'
    if 'pratic' in t or re.search(r'\bT[ABC]', tipo):
        return 'Prática'
    return 'Teórica'


def parse(pdf_path):
    brutas, data = [], None
    for r in ler_linhas(pdf_path):
        cel_data, hora, tema, tipo, prof, disc, local = r
        m = re.match(r'\s*(\d{2})/(\d{2})', cel_data)
        if m:
            data = f'{ANO}-{m.group(2)}-{m.group(1)}'
        if not data:
            continue
        h = re.findall(r'(\d{1,2}):(\d{2})', hora)
        tema_l = limpar(tema)
        if not h:
            # continuação de célula de várias linhas (tema quebrado)
            if tema_l and brutas and brutas[-1]['data'] == data and not vazio(tema):
                brutas[-1]['tema'] += ' ' + tema_l
            elif tema_l and data:
                brutas.append({'data': data, 'inicio': '', 'fim': '', 'tema': tema_l, 'tipo': limpar(tipo),
                               'prof': limpar(prof), 'disc': limpar(disc), 'local': limpar(local)})
            continue
        ini = f'{int(h[0][0]):02d}:{h[0][1]}'
        fim = f'{int(h[-1][0]):02d}:{h[-1][1]}' if len(h) > 1 else ''
        brutas.append({'data': data, 'inicio': ini, 'fim': fim, 'tema': tema_l, 'tipo': limpar(tipo),
                       'prof': limpar(prof), 'disc': limpar(disc), 'local': limpar(local)})

    # Correções manuais por dia (substituem o que veio do PDF)
    datas_corrigidas = {d for d, *_ in CORRECOES}
    brutas = [b for b in brutas if b['data'] not in datas_corrigidas]
    for d, ini, fim, tema, tipo, prof, disc, local in CORRECOES:
        brutas.append({'data': d, 'inicio': ini, 'fim': fim, 'tema': tema, 'tipo': tipo,
                       'prof': prof, 'disc': disc, 'local': local})
    brutas.sort(key=lambda b: (b['data'], b['inicio']))
    return brutas


def classificar(brutas):
    aulas, avaliacoes, feriados = [], [], []
    anterior = None
    for b in brutas:
        # 2ª linha de um bloco duplo às vezes vem sem disciplina: herda da linha anterior
        if anterior and not b['disc'] and anterior['data'] == b['data'] and anterior['tema'] == b['tema']:
            b = {**b, 'disc': anterior['disc'], 'prof': b['prof'] or anterior['prof'], 'local': b['local'] or anterior['local']}
        anterior = b
        tema, up = b['tema'], b['tema'].upper()
        prof = '' if b['prof'] in ('-', '') else b['prof']
        local = '' if b['local'] in ('-', '') else b['local']
        disc = sem_acento(b['disc'])
        cad = CADEIRAS.get(disc, '')
        # O PDF trocou as disciplinas em 09/11: a professora define a cadeira
        if prof.startswith('Marília') and cad != 'genetica':
            relatorio.append(f"{b['data']}: '{tema}' estava como {b['disc']}; corrigido para Genética (profa. Marília)")
            cad = 'genetica'
        if prof.startswith('Sura') and cad not in ('histologia', 'morfo1'):
            relatorio.append(f"{b['data']}: '{tema}' estava como {b['disc']}; corrigido para Histologia (profa. Sura)")
            cad = 'histologia'

        if up.startswith('FERIADO') or 'SEMANA UNIVERSIT' in up:
            nome = re.sub(r'^FERIADO\s*(DIA\s*(D[AEO]S?)?\s*)?', '', tema, flags=re.I).strip()
            nome = re.sub(r' (Da|De|Do|Das|Dos) ', lambda m: ' ' + m.group(1).lower() + ' ', nome.title()) if nome else 'Feriado'
            feriados.append({'data': b['data'], 'nome': nome.replace('(Municipal)', '(municipal)').replace('(Ponto Facultativo)', '(ponto facultativo)')})
            continue
        if up in IGNORAR:
            continue
        if up in MODULOS_FIXOS:
            cid, nome = MODULOS_FIXOS[up]
            aulas.append(dict(data=b['data'], inicio=b['inicio'], fim=b['fim'], cadeira_id=cid, assunto=nome,
                              tipo='Módulo', turma='Todas', local=local, professor=''))
            continue
        if '2ª CHAMADA' in up:
            aulas.append(dict(data=b['data'], inicio=b['inicio'], fim=b['fim'], cadeira_id=cad,
                              assunto=tema.title().replace('Da ', 'da ').replace('De ', 'de ').replace('Das ', 'das ').replace('Pis', 'PIs'),
                              tipo='2ª chamada', turma='Todas', local=local, professor=prof))
            continue
        if re.search(r'AVALIA|PROVA|TESTE DE PROGRESSO|SEMIN[AÁ]RIO INTEGRADOR', up):
            if 'INTEGRADA' in up or 'SEMIN' in up or 'FINAL' in up or 'PROGRESSO' in up:
                cad = 'morfo1'
            if 'PROGRESSO' in up:
                tipo = 'Teste de progresso'
            elif 'SEMIN' in up:
                tipo = 'Seminário integrador'
            elif 'FINAL' in up:
                tipo = 'Prova final (se necessário)'
            elif 'INTEGRADA' in up:
                tipo = 'Prova integrada'
            elif cad == 'bioquimica':
                tipo = 'A confirmar'
                tema = 'Avaliação de Bioquímica (a confirmar)'
            elif 'PRÁTICA' in up or cad == 'anatomia':
                tipo = 'Prova prática'
            else:
                tipo = 'Prova teórica'
            titulo = ' '.join(w if w in ('ª',) else w.capitalize() for w in tema.lower().split())
            titulo = re.sub(r'\b(\d)ª', r'\1ª', titulo).replace('De ', 'de ').replace('Para ', 'para ')
            if tipo == 'A confirmar':
                titulo = tema
            avaliacoes.append(dict(data=b['data'], hora=b['inicio'], fim=b['fim'], cadeira_id=cad, titulo=titulo,
                                   tipo=tipo, conteudo='', turma='Todas', local=local, obs=''))
            continue
        turma = turma_de(b['tipo'], tema)
        assunto = re.sub(r'\s*\((T[AB]\d?(?:/\s*T[AB]\d?)*)\)\s*', '', tema).strip()
        if not cad:
            tipo = 'Evento'
        else:
            tipo = tipo_aula(b['tipo'])
        aulas.append(dict(data=b['data'], inicio=b['inicio'], fim=b['fim'], cadeira_id=cad, assunto=assunto,
                          tipo=tipo, turma=turma, local=local, professor=prof))
    return juntar(aulas, 'inicio'), juntar(avaliacoes, 'hora'), feriados


def juntar(itens, campo_ini):
    """Junta blocos seguidos iguais (ex.: 07:30–09:30 + 09:30–11:30 = 07:30–11:30)."""
    saida = []
    chave = lambda x: (x['data'], x['cadeira_id'], x.get('assunto', x.get('titulo')), x.get('tipo'), x.get('turma'))
    for it in itens:
        ant = saida[-1] if saida else None
        if ant and chave(ant) == chave(it) and ant['fim'] and ant['fim'] == it[campo_ini]:
            ant['fim'] = it['fim'] or ant['fim']
            if it.get('local') and it['local'] not in ant.get('local', ''):
                ant['local'] = f"{ant['local']} / {it['local']}" if ant.get('local') else it['local']
            continue
        saida.append(dict(it))
    return saida


def conteudo_avaliacoes(aulas, avaliacoes):
    """Conteúdo estimado: assuntos teóricos/práticos da cadeira desde a avaliação anterior."""
    ultima = {}
    for av in sorted(avaliacoes, key=lambda a: a['data']):
        cad = av['cadeira_id']
        if cad == 'morfo1' or not cad:
            continue
        desde = ultima.get(cad, '0000')
        assuntos = []
        for a in aulas:
            if a['cadeira_id'] == cad and desde <= a['data'] < av['data'] and a['tipo'] in ('Teórica', 'Prática', 'Caso clínico'):
                if a['assunto'] not in assuntos:
                    assuntos.append(a['assunto'])
        av['conteudo'] = '; '.join(assuntos)
        ultima[cad] = av['data']


def main():
    pdf_path = sys.argv[1]
    json_path = sys.argv[2] if len(sys.argv) > 2 else 'data/simulacao.json'
    aulas, avaliacoes, feriados = classificar(parse(pdf_path))
    conteudo_avaliacoes(aulas, avaliacoes)
    for av in avaliacoes:  # critérios da última página do PDF
        for (cad, trecho), (conteudo, obs) in OBS_AVALIACOES.items():
            if av['cadeira_id'] == cad and trecho in av['titulo']:
                av['conteudo'] = conteudo or av['conteudo']
                av['obs'] = obs
    for i, a in enumerate(aulas, 1):
        a['id'] = f'A{i:04d}'
    for i, a in enumerate(avaliacoes, 1):
        a['id'] = f'AV{i:02d}'
    ordem_aula = ['id', 'data', 'inicio', 'fim', 'cadeira_id', 'assunto', 'tipo', 'turma', 'local', 'professor']
    ordem_av = ['id', 'data', 'hora', 'fim', 'cadeira_id', 'titulo', 'tipo', 'conteudo', 'turma', 'local', 'obs']
    with open(json_path, encoding='utf-8') as f:
        dados = json.load(f)
    dados['Aulas'] = [{k: a[k] for k in ordem_aula} for a in aulas]
    dados['Avaliacoes'] = [{k: a[k] for k in ordem_av} for a in avaliacoes]
    dados['Feriados'] = feriados
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(aulas)} aulas, {len(avaliacoes)} avaliações, {len(feriados)} dias sem aula')
    for linha in relatorio:
        print(' -', linha)


# Critérios de avaliação (página final do PDF): (cadeira, trecho do título) -> (conteúdo fixo ou '', observação)
OBS_AVALIACOES = {
    ('biofisica', '1ª'): ('', 'Escrita, individual, vale 4,0.'),
    ('biofisica', '2ª'): ('', 'Escrita, individual, vale 4,0.'),
    ('biofisica', '3ª'): ('Trabalho em vídeo', 'Escrita e em vídeo, em grupo, vale 2,0. O PDF também a mostra em 30/10 (feriado); vale a data de 13/11 — confirmar.'),
    ('anatomia', 'Avaliação'): ('', 'Prática: identificação de peças anatômicas.'),
    ('citologia', 'Prova'): ('', 'Identificação de lâminas ao microscópio óptico (0 a 10).'),
    ('histologia', 'Prova'): ('', 'Identificação de lâminas ao microscópio óptico.'),
    # Catarina: Bioquímica tem dois trabalhos orais, sem prova prática (datas e pesos a confirmar)
    ('bioquimica', 'Avaliação'): ('A confirmar', 'A confirmar: segundo a turma, a nota de Bioquímica vem de dois trabalhos orais, sem prova prática. Data do PDF mantida até confirmar.'),
    ('morfo1', 'Integrada'): ('Conteúdo do módulo', 'Questões de múltipla escolha; peso 5 no módulo.'),
    ('morfo1', 'Seminário'): ('Seminário integrador', 'Nota entra como 3ª avaliação do módulo. Último dia letivo.'),
    ('morfo1', 'Final'): ('Todo o módulo', '30 a 40 questões de múltipla escolha. Provas finais de 14 a 18/12.'),
    ('morfo1', 'Progresso'): ('', 'Dia inteiro, sem aulas.'),
}

# Dias em que o PDF veio desalinhado ou ambíguo: (data, início, fim, tema, tipo, professor, disciplina, local)
CORRECOES = [
    ('2026-08-28', '07:30', '09:30', 'Cintura escapular e ossos dos membros superiores', 'Teórica', 'Emília Ferraz', 'Anatomia', 'CC1'),
    ('2026-08-28', '09:30', '11:30', 'Cintura escapular e ossos dos membros superiores', 'Prática (TC)', 'Emília Ferraz', 'Anatomia', 'Anfiteatro'),
    ('2026-08-28', '13:30', '15:30', 'Biofísica da membrana', 'Teórica', 'Marcos Ely', 'Biofísica', 'CC1'),
    ('2026-08-28', '15:30', '17:30', 'Eletrobiologia', 'Teórica', 'Marcos Ely', 'Biofísica', 'CC1'),
    ('2026-09-02', '', '', 'TESTE DE PROGRESSO PARA MEDICINA', '', '', 'Todas', ''),
    ('2026-09-30', '07:30', '09:30', 'Músculos da mastigação e músculos anterolaterais do pescoço', 'Teórica', 'Romero Souto', 'Anatomia', 'CC1'),
    ('2026-09-30', '09:30', '11:30', 'Músculos da mastigação e músculos anterolaterais do pescoço', 'Prática (TC)', 'Romero Souto', 'Anatomia', 'Anfiteatro'),
    ('2026-09-30', '13:30', '17:30', 'ID', '', '', '', 'CC1'),
    ('2026-10-12', '', '', 'FERIADO Nossa Senhora Aparecida', '', '', '', ''),
    # 30/10: o PDF marca "Feriado funcionário público"; Veias e a 3ª Av. de Biofísica foram remarcadas (a avaliação está em 13/11)
    ('2026-10-30', '', '', 'FERIADO Servidor Público (ponto facultativo)', '', '', '', ''),
    ('2026-11-20', '', '', 'FERIADO Consciência Negra', '', '', '', ''),
    ('2026-12-07', '07:30', '11:30', 'IM', '', '', '', ''),
    ('2026-12-08', '', '', 'FERIADO Nossa Senhora da Conceição (municipal)', '', '', '', ''),
    ('2026-12-11', '07:30', '11:30', 'SEMINÁRIO INTEGRADOR', '', 'Ana, Sura, Marília, Cristina', 'Todas', 'CC1'),
    ('2026-12-14', '07:30', '11:30', 'IM', '', '', '', 'CC1'),
    ('2026-12-14', '13:30', '17:30', '2ª PROVA INTEGRADA', 'Teórica', 'Ana Maria', 'Todas', 'CC1'),
]

if __name__ == '__main__':
    main()
