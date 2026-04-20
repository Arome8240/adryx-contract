;; ============================================================
;; Adryx Token (ADAD)
;; SIP-010 Fungible Token for the Adryx advertising network
;;
;; Used for:
;;   - Paying for ad campaigns (advertisers)
;;   - Rewarding publishers
;;   - Incentivizing user engagement
;; ============================================================

;; SIP-010 trait - canonical mainnet address
;; SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE is the Stacks Foundation deployer
;; For local testing, sip-010-trait.clar provides this trait via Clarinet.toml
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; ============================================================
;; Constants
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)
(define-constant TOKEN-NAME "Adryx Token")
(define-constant TOKEN-SYMBOL "ADAD")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000000) ;; 1 billion ADAD (with 6 decimals)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-AMOUNT (err u101))
(define-constant ERR-INSUFFICIENT-BALANCE (err u102))
(define-constant ERR-MAX-SUPPLY-EXCEEDED (err u103))
(define-constant ERR-INVALID-RECIPIENT (err u104))

;; ============================================================
;; Storage
;; ============================================================

;; SIP-010 fungible token definition (no hard cap enforced at token level - we manage it manually)
(define-fungible-token adryx-token)

;; Mutable contract owner (allows ownership transfer)
(define-data-var contract-owner principal CONTRACT-OWNER)

;; ============================================================
;; Private helpers
;; ============================================================

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner)))

;; ============================================================
;; SIP-010 Required Functions
;; ============================================================

;; Transfer tokens from sender to recipient
;; memo is an optional buffer for on-chain notes (e.g. campaign ID)
(define-public (transfer
    (amount uint)
    (sender principal)
    (recipient principal)
    (memo (optional (buff 34))))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-eq sender recipient)) ERR-INVALID-RECIPIENT)
    (try! (ft-transfer? adryx-token amount sender recipient))
    ;; Emit transfer event via print
    (print {
      event: "transfer",
      amount: amount,
      sender: sender,
      recipient: recipient,
      memo: memo
    })
    (ok true)))

;; Return token name
(define-read-only (get-name)
  (ok TOKEN-NAME))

;; Return token symbol
(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL))

;; Return number of decimals
(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS))

;; Return balance of a given principal
(define-read-only (get-balance (account principal))
  (ok (ft-get-balance adryx-token account)))

;; Return total circulating supply
(define-read-only (get-total-supply)
  (ok (ft-get-supply adryx-token)))

;; SIP-010 token URI (optional metadata endpoint)
(define-read-only (get-token-uri)
  (ok (some u"https://adryx.io/token-metadata.json")))

;; ============================================================
;; Minting
;; ============================================================

;; Mint new tokens - only contract owner
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts!
      (<= (+ (ft-get-supply adryx-token) amount) MAX-SUPPLY)
      ERR-MAX-SUPPLY-EXCEEDED)
    (try! (ft-mint? adryx-token amount recipient))
    (print {
      event: "mint",
      amount: amount,
      recipient: recipient,
      new-supply: (ft-get-supply adryx-token)
    })
    (ok true)))

;; ============================================================
;; Burning
;; ============================================================

;; Burn tokens from caller's own balance
(define-public (burn (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= (ft-get-balance adryx-token tx-sender) amount) ERR-INSUFFICIENT-BALANCE)
    (try! (ft-burn? adryx-token amount tx-sender))
    (print {
      event: "burn",
      amount: amount,
      burner: tx-sender,
      new-supply: (ft-get-supply adryx-token)
    })
    (ok true)))

;; ============================================================
;; Admin / Access Control
;; ============================================================

;; Transfer contract ownership to a new principal
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-owner) ERR-NOT-AUTHORIZED)
    (print { event: "ownership-transfer", old-owner: (var-get contract-owner), new-owner: new-owner })
    (ok (var-set contract-owner new-owner))))

;; Read current contract owner
(define-read-only (get-contract-owner)
  (ok (var-get contract-owner)))
