import random
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rdkit import Chem
from rdkit.Chem import AllChem, QED, Descriptors, rdMolDescriptors

class GenerateRequest(BaseModel):
    prompt: Optional[str] = ""
    qed: float
    logp: float
    tpsa: float
    mw: float

class MoleculeResult(BaseModel):
    smiles: str
    sdf_string: Optional[str]
    qed: float
    logp: float
    tpsa: float
    mw: float
    lipinski: int
    reward_score: float

class GenerateResponse(BaseModel):
    prompt: str
    valid_count: int
    validity_pct: float
    molecules: List[MoleculeResult]

app = FastAPI(title="Electrothon Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _lipinski_violations(mol):
    violations = 0
    if Descriptors.MolWt(mol) > 500:
        violations += 1
    if Descriptors.MolLogP(mol) > 5:
        violations += 1
    if rdMolDescriptors.CalcNumHBD(mol) > 5:
        violations += 1
    if rdMolDescriptors.CalcNumHBA(mol) > 10:
        violations += 1
    return violations

def _reward(mol, target_qed, target_logp, target_tpsa, target_mw):
    qed = QED.qed(mol)
    logp = Descriptors.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    mw = Descriptors.MolWt(mol)
    score = 1 / (1 + abs(qed - target_qed) + abs(logp - target_logp) + abs(tpsa - target_tpsa) + abs(mw - target_mw))
    return score

# A much larger list of SMILES to pull from, to prevent exact same results.
CANDIDATE_SMILES = [
    "CCO", "CCN", "CCOC(=O)C", "c1ccccc1", "COc1cccc(OC)c1",
    "CC(C)Oc1ccc(CCN)cc1", "CC(C)CC(=O)O", "C1CCCCC1", "CC(=O)Nc1ccc(O)cc1",
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", "CC(=O)OC1=CC=CC=C1C(=O)O",
    "CN1CC2CCC1CC2", "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C", "O=C(O)Cc1ccccc1",
    "CCC(C)(C)C(=O)O", "CC1(C)C2CCC1(C)C(=O)C2", "CC(C)(C)c1ccc(O)cc1", "COCc1ccccc1",
    "CCn1cc(C(=O)O)c(=O)c2cc(F)c(N3CCN(C)CC3)cc21", "O=c1[nH]cnc2c1ncn2C", "C1COCCO1",
    "CN(C)C(=N)N=C(N)N", "NC(=O)c1cnccn1", "CC(=O)NC1C(C(=O)O)OC(Oc2ccccc2)C(O)C1O"
]

def call_generation_model(request: GenerateRequest) -> List[MoleculeResult]:
    results: List[MoleculeResult] = []
    
    # Use prompt string to seed the random pool if available, to provide different consistent results, 
    # but give different molecules across different prompts.
    rng = random.Random()
    if request.prompt and request.prompt.strip():
        rng.seed(request.prompt)
    else:
        rng.seed()

    # ensure we have plenty of varieties.
    chosen_smiles = rng.sample(CANDIDATE_SMILES, min(len(CANDIDATE_SMILES), 10))

    for smi in chosen_smiles:
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue

        sdf_string: Optional[str] = None
        try:
            mol3d = Chem.AddHs(mol)
            params = AllChem.ETKDGv3()
            params.randomSeed = rng.randint(1, 1000000) 
            status = AllChem.EmbedMolecule(mol3d, params)
            if status == 0:
                AllChem.UFFOptimizeMolecule(mol3d, maxIters=200)
                mol3d = Chem.RemoveHs(mol3d)
                sdf_string = Chem.MolToMolBlock(mol3d) + "\n$$$$\n"
        except Exception as e:
            print(f"3D Generation failed for {smi}: {e}")
            sdf_string = None

        qed_val = float(QED.qed(mol))
        logp_val = float(Descriptors.MolLogP(mol))
        tpsa_val = float(rdMolDescriptors.CalcTPSA(mol))
        mw_val = float(Descriptors.MolWt(mol))
        
        results.append(
            MoleculeResult(
                smiles=smi,
                sdf_string=sdf_string,
                qed=qed_val,
                logp=logp_val,
                tpsa=tpsa_val,
                mw=mw_val,
                lipinski=_lipinski_violations(mol),
                reward_score=float(_reward(mol, request.qed, request.logp, request.tpsa, request.mw))
            )
        )

    results.sort(key=lambda r: r.reward_score, reverse=True)
    return results[:5]

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Electrothon Backend is running"}

@app.post("/generate")
def generate(request: GenerateRequest) -> GenerateResponse:
    results = call_generation_model(request)
    return GenerateResponse(
        prompt=request.prompt or "",
        valid_count=len(results),
        validity_pct=len(results) / 5 * 100,
        molecules=results
    )
    