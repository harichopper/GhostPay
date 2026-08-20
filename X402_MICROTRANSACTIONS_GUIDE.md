# ?? GhostPay x402 Micro-Transaction Architecture Guide

## ?? Executive Summary

GhostPay implements the **x402 Payment Protocol** (HTTP Status `402 Payment Required`) on **Algorand Testnet** to monetize AI-powered pre-flight security scans. When autonomous AI payment agents or users initiate transactions, an x402 micro-fee is transferred from the payer's wallet to the GhostPay service provider wallet before authorization.

---

## ??? Account & Wallet Architecture

```
+--------------------------------------+                     +--------------------------------------+
¦       Payer (Sender Wallet)          ¦   HTTP x402 Header ¦     Service Provider (Pay-To)        ¦
¦                                      +--------------------?¦                                      ¦
¦  User / AI Agent Algorand Wallet     ¦   0.005 USDC/ALGO   ¦  GhostPay Merchant Security Wallet   ¦
¦  (e.g., UMEYMXPCZUQX...7NVCSWQ)      ¦   Micro-Fee         ¦  EI5WNOWDB2S5MOHNVZXNVUULCKBMUG4B... ¦
+--------------------------------------+                     +--------------------------------------+
```

### 1. Payer / Sender Wallet
- **Account Type**: Active User Wallet / Autonomous AI Agent Wallet.
- **Address**: Dynamically assigned based on the active logged-in wallet in GhostPay (e.g. `UMEYMX...`).
- **Role**: Signs and pays the required micro-fee (0.005 USDC/ALGO) per security query.

### 2. Service Provider / Pay-To Wallet
- **Account Type**: GhostPay Merchant & Security Engine Vault.
- **Configured Algorand Address**:
  `EI5WNOWDB2S5MOHNVZXNVUULCKBMUG4BC5AZUAL2S5T2PZ5DW2FCF4KYCA`
- **Configuration Variable**: `RESOURCE_PAY_TO` in `GhostPay-X402-Endpoints/.env`.
- **Role**: Receives the micro-payment fee for executing real-time threat intelligence and fraud risk scoring.

---

## ?? Micro-Fee Schedule

| API Endpoint | Description | Micro-Fee (USD) | Asset |
| :--- | :--- | :---: | :---: |
| `POST /api/v1/security/wallet-risk` | Real-time Sender & Receiver threat score analysis | **$0.005** | USDC / ALGO |
| `POST /api/v1/security/receiver-validation` | Merchant verification & scam address check | **$0.005** | USDC / ALGO |
| `POST /api/v1/security/transaction-analysis` | Pre-flight invoice & payment fraud analysis | **$0.100** | USDC / ALGO |

---

## ?? Protocol & Network Configuration

- **Blockchain Network**: **Algorand Testnet** (`algorand:testnet` CAIP-2 standard).
- **x402 Facilitator URL**: `https://x402.org/facilitator`
- **Scheme**: `ExactAvmScheme` (Algorand Virtual Machine exact payment verification).
- **Backend Microservice**: `GhostPay-X402-Endpoints` (`https://ghpay.vercel.app`).
