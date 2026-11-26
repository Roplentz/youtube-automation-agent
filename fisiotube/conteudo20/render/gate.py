"""Trava de revisão do lado Python.

O CLI em Node já bloqueia o render, mas os scripts render.py e render_v2.py também podem ser
chamados direto. Esta trava repete as checagens essenciais para que um render completo nunca
saia de um roteiro sem revisão humana ou com prova sem PMID. Prévias de quadros não passam por aqui.
"""
import json
import re
import sys

PMID = re.compile(r'PMID\s*:?\s*(\d+)', re.I)


def _base(doc):
    errors = []
    if doc.get('publishingEnabled') is not False:
        errors.append('publishingEnabled must be false')
    if doc.get('scientificReviewRequired') is not True:
        errors.append('scientificReviewRequired must be true')
    cenas = doc.get('cenas') or []
    if not cenas:
        errors.append('cenas must be a non-empty array')
    pending = [str(c.get('id', '?')) for c in cenas if c.get('revisado') is not True]
    if pending:
        errors.append('scenes pending human review: ' + ', '.join(pending))
    return errors


def _refs(doc):
    return {str(r.get('pmid')) for r in doc.get('references') or []}


def check_storyboard(doc):
    errors = _base(doc)
    refs = _refs(doc)
    for c in doc.get('cenas') or []:
        for claim in c.get('claims') or []:
            ids = [str(i) for i in claim.get('pmids') or []]
            if not ids or not all(i in refs for i in ids):
                errors.append(f"{c.get('id', '?')}: claim without traceable source: \"{claim.get('text', '')}\"")
    return errors


def check_roteiro(doc):
    errors = _base(doc)
    refs = _refs(doc)
    for c in doc.get('cenas') or []:
        if c.get('tipo') in ('prova', 'dados'):
            ids = PMID.findall(str(c.get('fonte', '')))
            if not ids or not all(i in refs for i in ids):
                errors.append(f"{c.get('id', '?')}: {c.get('tipo')} without a PMID listed in references")
    return errors


def enforce(path, kind):
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    errors = check_storyboard(doc) if kind == 'storyboard' else check_roteiro(doc)
    if errors:
        sys.exit('Render bloqueado (' + path + '):\n- ' + '\n- '.join(errors))
