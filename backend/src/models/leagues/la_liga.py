"""La Liga specific model - inherits from EnsembleModel"""
from typing import Optional
import pandas as pd
from ..ensemble import EnsembleModel


class LaLigaModel(EnsembleModel):
    """La Liga prediction model using GodStack Super Learner"""
    
    def __init__(self):
        super().__init__(optimize=False)
        self.league_id = "La Liga"
        self.league_code = "laliga"
