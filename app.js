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

// CONSERVÉ ET SÉCURISÉ : Ta fonction d'affichage d'origine, augmentée de la valeur en $ et du traducteur de symboles
function renderTokens(tokens) {

    dustContainer.innerHTML = "";

    tokens.forEach(token => {

        // On ignore les lignes totalement vides
        if (token.tokenBalance === "0x" || token.tokenBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            return;
        }

        // --- CALCULS SANS RIEN SUPPRIMER ---
        // 1. Conversion des balances hexadécimales en nombres lisibles (avec décimales standard à 18)
        const balanceBigInt = BigInt(token.tokenBalance);
        const balanceFormatee = ethers.formatUnits(balanceBigInt, 18);
        const quantiteNumerique = Number(balanceFormatee);

        // 2. Détermination du nom et estimation du prix réel
        let nomDuJeton = "DREAM";
        let prixDuJetonUsd = 0.04; // Prix estimé pour ton jeton DREAM

        if (token.contractAddress.toLowerCase() === "0xc8c75f020a9cca652e9d2c2c13fa3c7522d2626a") {
            nomDuJeton = "JIM";
            prixDuJetonUsd = 0.000002; // Prix estimé pour ton JIM
        }

        // 3. Calcul de la valeur totale en dollars
        const valeurTotaleUsd = quantiteNumerique * prixDuJetonUsd;

        const div = document.createElement("div");
        div.className = "token";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.margin = "10px 0";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.borderRadius = "8px";

        // Garde ta structure d'affichage exacte en ajoutant le Nom et la Valeur en vert
        div.innerHTML = `
            <input type="checkbox" style="margin-right: 15px; transform: scale(1.2);" />
            <div style="text-align: left; flex-grow: 1;">
                <strong style="font-size: 16px; color: #333;">${nomDuJeton}</strong>
                <span style="font-size: 11px; color: gray; display: block; word-break: break-all;">${token.contractAddress}</span>
                <div style="font-weight: bold; margin-top: 5px; display: flex; justify-content: space-between;">
                    <span style="color: #007bff;">Quantité : ${quantiteNumerique.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</span>
                    <span style="color: #28a745;">Valeur : $${valeurTotaleUsd.toFixed(2)}</span>
                </div>
            </div>
        `;

        // On injecte les données calculées dans l'objet token pour que le bouton en bas s'en rappelle
        token.symbol = nomDuJeton;
        token.calculatedUsd = valeurTotaleUsd;
        token.balanceFormatted = balanceFormatee;

        const checkbox = div.querySelector("input");
        checkbox.addEventListener("change", e => {
            if (e.target.checked) {
                selectedTokens.push(token);
            } else {
                selectedTokens = selectedTokens.filter(
                    t => t.contractAddress !== token.contractAddress
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

    // Somme automatique des valeurs USD des lignes que tu as cochées
    let totalSelectionUsd = selectedTokens.reduce(
        (sum, t) => sum + Number(t.calculatedUsd || 0),
        0
    );

    // Formule : 1$ de valeur totale = 100 000 JIM
    const estimatedJIM = Math.floor(totalSelectionUsd * 100000);

    // Si le montant est infime (ex: $0.00), on force un affichage minimum à 500 JIM
    cleanButton.innerText = `Recevoir ~ ${estimatedJIM > 0 ? estimatedJIM : 500} JIM ($${totalSelectionUsd.toFixed(2)})`;
}

// CORRIGÉ : Ajout du changement de réseau automatisé pour éviter les crashs de transactions cross-chain
cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            const targetChainId = CHAIN_IDS[token.chain || "base"];
            
            statusDiv.innerHTML = `⏳ Basculement vers le réseau Base...`;
            
            // On force MetaMask à changer de blockchain pour correspondre au jeton sélectionné
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainId }],
                });
            } catch (switchError) {
                // Si le réseau n'est pas configuré dans son MetaMask, on l'arrête proprement
                alert(`S'il te plaît, ajoute ou sélectionne le réseau Base dans ton MetaMask.`);
                throw new Error("Réseau non disponible");
            }

            // On recrée proprement le provider et le signer après le changement de réseau
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                [
                    "function transfer(address to, uint256 amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML = `⏳ Autorisation et transfert de ${token.symbol}...`;

            // Envoi sécurisé du montant avec BigInt
            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.tokenBalance.toString())
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
