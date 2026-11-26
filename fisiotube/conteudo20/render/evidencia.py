"""Selo de nível de evidência do card de prova. Espelha fisiotube/evidencia.js (mantenha os dois iguais)."""
import re

NIVEL_POR_DESENHO = {
    'metanalise': 'A', 'revisao_sistematica': 'A', 'diretriz': 'A',
    'ecr': 'B', 'ensaio_clinico': 'B',
    'observacional': 'C',
    'relato_de_caso': 'D', 'revisao_narrativa': 'D', 'outro': 'D',
}
ROTULO_NIVEL = {'A': 'EVIDÊNCIA FORTE', 'B': 'EVIDÊNCIA MODERADA', 'C': 'EVIDÊNCIA LIMITADA', 'D': 'EVIDÊNCIA FRACA'}
ROTULO_DESENHO = {
    'metanalise': 'METANÁLISE', 'revisao_sistematica': 'REVISÃO SISTEMÁTICA', 'diretriz': 'DIRETRIZ',
    'ecr': 'ECR', 'ensaio_clinico': 'ENSAIO CLÍNICO', 'observacional': 'OBSERVACIONAL',
    'relato_de_caso': 'RELATO DE CASO', 'revisao_narrativa': 'REVISÃO NARRATIVA', 'outro': 'ESTUDO',
}
ORDEM = ['A', 'B', 'C', 'D']


def nivel_referencia(ref):
    if ref.get('nivel') in ORDEM:
        return ref['nivel']
    if ref.get('nivel_desenho') in ORDEM:
        return ref['nivel_desenho']
    return NIVEL_POR_DESENHO.get(ref.get('design'))


def selo_cena(cena, references):
    """(nivel, texto) do card, ou (None, None) se não houver nível conhecido."""
    if cena.get('nivel') in ORDEM:
        return cena['nivel'], ROTULO_NIVEL[cena['nivel']]
    best = None
    for pmid in re.findall(r'PMID\s*:?\s*(\d+)', str(cena.get('fonte', '')), re.I):
        ref = next((r for r in references if str(r.get('pmid')) == pmid), None)
        n = nivel_referencia(ref) if ref else None
        if n and (best is None or ORDEM.index(n) < ORDEM.index(best[0])):
            best = (n, ref)
    if not best:
        return None, None
    n, ref = best
    texto = ROTULO_NIVEL[n]
    desenho = ROTULO_DESENHO.get(ref.get('design'))
    if desenho:
        texto += ' · ' + desenho + (f" {ref['year']}" if ref.get('year') else '')
    return n, texto
