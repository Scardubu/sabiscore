"""Serie A specific model - inherits from EnsembleModel"""
from typing import Optional
import pandas as pd
from ..ensemble import EnsembleModel


class SerieAModel(EnsembleModel):
    """Serie A prediction model using GodStack Super Learner"""
    
    def __init__(self):
        super().__init__(optimize=False)
        self.league_id = "Serie A"
        self.league_code = "seriea"
