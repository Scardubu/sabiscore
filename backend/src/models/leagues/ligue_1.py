"""Ligue 1 specific model - inherits from EnsembleModel"""
from typing import Optional
import pandas as pd
from ..ensemble import EnsembleModel


class Ligue1Model(EnsembleModel):
    """Ligue 1 prediction model using GodStack Super Learner"""
    
    def __init__(self):
        super().__init__(optimize=False)
        self.league_id = "Ligue 1"
        self.league_code = "ligue1"
