'use client';

import { memo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface HeaderProps {
  onDollarClick: () => void;
  isInverted: boolean;
}

export const Header = memo(function Header({ onDollarClick, isInverted }: HeaderProps) {
  return (
    <header className="sticky-header">
      <button 
        className={`dollar-button ${isInverted ? 'inverted' : ''}`}
        onClick={onDollarClick}
        title="Get test funds"
      >
        $
      </button>
      <div className="wallet-button">
        <ConnectButton 
          label="Connect"
          showBalance={false}
          chainStatus="none"
          accountStatus="address"
          showRecentTransactions={true}
        />
      </div>
    </header>
  );
});
