"""python3 -m unittest discover -s fisiotube/conteudo20/render -p 'test_*.py'"""
import json, os, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(__file__))
from gate import check_roteiro, check_storyboard  # noqa: E402

OK = {'publishingEnabled': False, 'scientificReviewRequired': True, 'references': [{'pmid': '123'}]}


class GateTest(unittest.TestCase):
    def test_roteiro_ok(self):
        doc = {**OK, 'cenas': [{'id': 'c1', 'tipo': 'prova', 'fonte': 'PMID 123', 'revisado': True}]}
        self.assertEqual(check_roteiro(doc), [])

    def test_roteiro_blocks_unreviewed_and_unsourced(self):
        doc = {**OK, 'cenas': [{'id': 'c1', 'tipo': 'prova', 'fonte': 'PMID 999'}]}
        errors = check_roteiro(doc)
        self.assertTrue(any('pending human review' in e for e in errors))
        self.assertTrue(any('PMID listed' in e for e in errors))

    def test_publishing_must_stay_off(self):
        doc = {**OK, 'publishingEnabled': True, 'cenas': [{'id': 'c1', 'revisado': True}]}
        self.assertIn('publishingEnabled must be false', check_storyboard(doc))

    def test_storyboard_claims_need_sources(self):
        doc = {**OK, 'cenas': [{'id': 'c1', 'revisado': True, 'claims': [{'text': 'x', 'pmids': []}]}]}
        self.assertTrue(check_storyboard(doc))

    def test_enforce_exits_with_error(self):
        here = os.path.dirname(os.path.abspath(__file__))
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, 'roteiro.json'), 'w', encoding='utf-8') as f:
                json.dump({**OK, 'cenas': [{'id': 'c1', 'tipo': 'kinetic', 'dur': 2}]}, f)
            r = subprocess.run([sys.executable, '-c', 'import sys; sys.argv=["render_v2.py","roteiro.json"]; '
                                'sys.path.insert(0, %r); from gate import enforce; enforce("roteiro.json","roteiro")' % here],
                               cwd=d, capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('Render bloqueado', r.stderr)


if __name__ == '__main__':
    unittest.main()
