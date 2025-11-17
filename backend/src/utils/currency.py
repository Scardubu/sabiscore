"""
Naira (₦) Currency Utilities for SabiScore Edge v3.0

All financial metrics use Nigerian Naira:
- Base bankroll: ₦10,000
- Exchange rate: ₦1,580 = $1 USD (Nov 2025)
- Kelly fraction: ⅛ (0.125)
- Minimum edge: ₦66 (4.2%)
"""

from typing import Union


# Currency Constants
NGN_PER_USD = 1580.0  # Nigerian Naira to USD exchange rate (Nov 2025)
BASE_BANKROLL_NGN = 10_000  # Base betting unit in Naira
KELLY_FRACTION = 0.125  # ⅛ Kelly (conservative)
MIN_EDGE_NGN = 66  # Minimum edge threshold (₦66 = 4.2% of ₦10k)


def format_naira(
    amount: Union[int, float],
    decimals: int = 0,
    show_symbol: bool = True,
    compact: bool = False
) -> str:
    """
    Format amount in Nigerian Naira with proper localization
    
    Args:
        amount: Amount in Naira
        decimals: Number of decimal places (default: 0 for whole naira)
        show_symbol: Include ₦ symbol (default: True)
        compact: Use compact notation for large numbers (default: False)
    
    Returns:
        Formatted string like "₦1,580" or "₦1.58M"
    
    Examples:
        >>> format_naira(1580000)
        '₦1,580,000'
        >>> format_naira(1580000, compact=True)
        '₦1.58M'
        >>> format_naira(66.5, decimals=1)
        '₦66.5'
    """
    symbol = "₦" if show_symbol else ""
    
    if compact and abs(amount) >= 1_000_000:
        # Millions
        value = amount / 1_000_000
        return f"{symbol}{value:.2f}M"
    elif compact and abs(amount) >= 1_000:
        # Thousands
        value = amount / 1_000
        return f"{symbol}{value:.1f}K"
    else:
        # Standard formatting with comma separators
        formatted = f"{amount:,.{decimals}f}"
        return f"{symbol}{formatted}"


def format_edge(edge: float, show_sign: bool = True) -> str:
    """
    Format edge value with proper sign
    
    Args:
        edge: Edge value in Naira
        show_sign: Include + for positive edges (default: True)
    
    Returns:
        Formatted string like "+₦186" or "-₦42"
    
    Examples:
        >>> format_edge(186)
        '+₦186'
        >>> format_edge(-42)
        '-₦42'
    """
    sign = "+" if edge >= 0 and show_sign else ""
    return f"{sign}{format_naira(edge, decimals=0)}"


def format_kelly_stake(
    bankroll: float,
    edge: float,
    kelly_fraction: float = KELLY_FRACTION
) -> str:
    """
    Calculate and format Kelly stake
    
    Args:
        bankroll: Total bankroll in Naira
        edge: Edge percentage (e.g., 0.093 for 9.3%)
        kelly_fraction: Fraction of Kelly to use (default: 0.125 = ⅛)
    
    Returns:
        Formatted stake like "₦53,720"
    
    Examples:
        >>> format_kelly_stake(1580000, 0.093)
        '₦18,404'
        >>> format_kelly_stake(1000000, 0.042, 0.25)
        '₦10,500'
    """
    stake = bankroll * kelly_fraction * edge
    return format_naira(stake, decimals=0)


def calculate_roi_percent(profit: float, stake: float) -> float:
    """
    Calculate ROI as percentage
    
    Args:
        profit: Profit/loss in Naira
        stake: Total staked in Naira
    
    Returns:
        ROI as percentage (e.g., 18.4 for +18.4%)
    
    Examples:
        >>> calculate_roi_percent(18400, 100000)
        18.4
    """
    if stake == 0:
        return 0.0
    return (profit / stake) * 100


def naira_to_usd(amount_ngn: float) -> float:
    """
    Convert Naira to USD
    
    Args:
        amount_ngn: Amount in Naira
    
    Returns:
        Amount in USD
    
    Examples:
        >>> naira_to_usd(1580)
        1.0
        >>> naira_to_usd(79000)
        50.0
    """
    return amount_ngn / NGN_PER_USD


def usd_to_naira(amount_usd: float) -> float:
    """
    Convert USD to Naira
    
    Args:
        amount_usd: Amount in USD
    
    Returns:
        Amount in Naira
    
    Examples:
        >>> usd_to_naira(1)
        1580.0
        >>> usd_to_naira(50)
        79000.0
    """
    return amount_usd * NGN_PER_USD


def format_clv(clv: float) -> str:
    """
    Format Closing Line Value
    
    Args:
        clv: CLV in Naira (positive = beat closing line)
    
    Returns:
        Formatted CLV like "+₦60" (average target)
    
    Examples:
        >>> format_clv(60)
        '+₦60'
        >>> format_clv(-15)
        '-₦15'
    """
    return format_edge(clv, show_sign=True)


# Validation Functions
def is_valid_edge(edge_ngn: float, min_threshold: float = MIN_EDGE_NGN) -> bool:
    """
    Check if edge meets minimum threshold
    
    Args:
        edge_ngn: Edge in Naira
        min_threshold: Minimum edge threshold (default: ₦66)
    
    Returns:
        True if edge >= threshold
    
    Examples:
        >>> is_valid_edge(186)
        True
        >>> is_valid_edge(50)
        False
    """
    return edge_ngn >= min_threshold


def calculate_edge_percent(
    fair_prob: float,
    implied_prob: float,
    stake: float = BASE_BANKROLL_NGN
) -> tuple[float, float]:
    """
    Calculate edge percentage and edge in Naira
    
    Args:
        fair_prob: Fair probability from model (e.g., 0.563)
        implied_prob: Implied probability from odds (e.g., 0.510)
        stake: Stake size in Naira (default: ₦10,000)
    
    Returns:
        Tuple of (edge_percent, edge_ngn)
    
    Examples:
        >>> calculate_edge_percent(0.563, 0.510)
        (10.4, 520.0)
    """
    edge_pct = ((fair_prob - implied_prob) / implied_prob) * 100
    edge_ngn = (fair_prob - implied_prob) * stake
    return edge_pct, edge_ngn


# Display Helpers
def format_metric_box(
    label: str,
    value: Union[int, float],
    is_currency: bool = False,
    is_percentage: bool = False
) -> dict:
    """
    Format metric for dashboard display
    
    Args:
        label: Metric label (e.g., "Average CLV")
        value: Metric value
        is_currency: Format as Naira (default: False)
        is_percentage: Format as percentage (default: False)
    
    Returns:
        Dictionary with formatted metric
    
    Examples:
        >>> format_metric_box("Average CLV", 60, is_currency=True)
        {'label': 'Average CLV', 'value': '₦60', 'raw': 60}
        >>> format_metric_box("ROI", 18.4, is_percentage=True)
        {'label': 'ROI', 'value': '18.4%', 'raw': 18.4}
    """
    if is_currency:
        formatted = format_naira(value)
    elif is_percentage:
        formatted = f"{value:.1f}%"
    else:
        formatted = f"{value:,.0f}"
    
    return {
        "label": label,
        "value": formatted,
        "raw": value
    }


# Export all utilities
__all__ = [
    "NGN_PER_USD",
    "BASE_BANKROLL_NGN",
    "KELLY_FRACTION",
    "MIN_EDGE_NGN",
    "format_naira",
    "format_edge",
    "format_kelly_stake",
    "calculate_roi_percent",
    "naira_to_usd",
    "usd_to_naira",
    "format_clv",
    "is_valid_edge",
    "calculate_edge_percent",
    "format_metric_box",
]
