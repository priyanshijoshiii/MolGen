from __future__ import annotations

import hashlib
import os
import time
from typing import Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Crippen, QED
except Exception as e:  # pragma: no cover
    Chem = None  # type: ignore[assignment]
    AllChem = None  # type: ignore[assignment]
    Crippen = None  # type: ignore[assignment]
    QED = None  # type: ignore[assignment]
    _rdkit_import_error = e
else:
    _rdkit_import_error = None

from main import call_generation_model, GenerateRequest, MoleculeResult


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


def generate_smiles_from_model() -> str:
    """
    Placeholder for your trained diffusion model inference.
    Replace this with your model's SMILES output.
    """
    candidates = [
        "CCO",  # ethanol
        "c1ccccc1",  # benzene
        "CC(=O)OC1=CC=CC=C1C(=O)O",  # aspirin
        "CCN(CC)CC",  # triethylamine-ish
        "CC(C)OC(=O)N1CCCC1C(=O)O",  # random small drug-like
    ]
    i = int(time.time()) % len(candidates)
    return candidates[i]


def smiles_to_3d_sdf(smiles: str) -> str:
    if _rdkit_import_error is not None:
        raise HTTPException(
            status_code=500,
            detail=f"RDKit import failed. Install backend requirements. Error: {_rdkit_import_error}",
        )
    assert Chem is not None and AllChem is not None

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    mol = Chem.AddHs(mol)

    params = AllChem.ETKDGv3()
    params.randomSeed = 0xF00D
    res = AllChem.EmbedMolecule(mol, params)
    if res != 0:
        # Retry with a more permissive embedding if ETKDG fails.
        res = AllChem.EmbedMolecule(mol, randomSeed=0xF00D, useRandomCoords=True)
        if res != 0:
            raise HTTPException(status_code=500, detail="3D coordinate generation failed")

    AllChem.UFFOptimizeMolecule(mol, maxIters=200)

    block = Chem.MolToMolBlock(mol)
    # 3Dmol.js is happy with standard MolBlock/SDF-like blocks.
    return block


def tx_hash_for_payload(payload: dict[str, Any]) -> str:
    # Demo-only: stable-ish fake tx hash, replace with real chain call.
    h = hashlib.sha256()
    h.update(os.urandom(8))
    h.update(repr(sorted(payload.items())).encode("utf-8"))
    return "0x" + h.hexdigest()


@app.post("/generate")
def generate(request: GenerateRequest) -> GenerateResponse:
    results = call_generation_model(request)
    return GenerateResponse(
        prompt="",
        valid_count=len(results),
        validity_pct=len(results) / 5 * 100,
        molecules=results
    )

