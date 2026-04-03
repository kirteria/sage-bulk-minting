'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface QrModalProps {
  uri: string;
  onClose: () => void;
}

export function QrModal({ uri, onClose }: QrModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
        <h3 className="text-lg font-semibold text-center">Connect Sage Wallet</h3>
        <p className="text-sm text-slate-600 text-center">
          Scan this QR code with Sage Wallet or copy the URI
        </p>
        
        <div className="flex justify-center p-4 bg-white rounded-lg">
          <QRCodeSVG value={uri} size={200} />
        </div>

        <div className="space-y-2">
          <Button onClick={handleCopy} variant="outline" className="w-full">
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy URI
              </>
            )}
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
