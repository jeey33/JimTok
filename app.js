const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

const COLLECTION_WALLET = "0x86E85282557fF41A7cD89AD7aA4BBD31CFea3fa9";

let provider;
let signer;

const NETWORKS = [
  "base",
  "eth",
  "polygon",
  "bsc",
  "arbitrum",
  "optimism"
];

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
    
    // Lance le scan simplifié
    scanDust(address);
};

// ÉTAPE 1 : Ta fonction scanDust simplifiée qui transmet tout le tableau brut à renderTokens
async function scanDust(wallet) {
    dustContainer.innerHTML = "🔍 Scan des poussières brutes...";
    let allTokens = [];

    for (const chain of NETWORKS) {
        try {
            const response = await fetch(
                `https://jimtok-backend.onrender.com/tokens/${wallet}/${chain}`
            );
            const tokens = await response.json();

            // Si Alchemy renvoie un tableau ou un objet contenant les jetons, on les accumule
            if (tokens && Array.isArray(tokens)) {
                tokens.forEach(token => {
                    allTokens.push({
                        ...token,
                        chain: chain
                    });
                });
            }
        } catch(err) {
            console.log("Erreur sur " + chain + ":", err);
        }
    }

    // On envoie la liste brute à l'affichage
    renderTokens(allTokens);
}

// ÉTAPE 2 : Ta fonction renderTokens modifiée pour afficher UNIQUEMENT le texte brut d'Alchemy
function renderTokens(tokens) {
    dustContainer.innerHTML = "";

    if (tokens.length === 0) {
        dustContainer.innerHTML = "Aucune donnée brute reçue du serveur.";
        return;
    }

    tokens.forEach(token => {
        const div = document.createElement("div");
        div.className = "token-raw";
        div.style.margin = "15px 0";
        div.style.padding = "10px";
        div.style.border = "1px dashed #777";
        div.style.fontFamily = "monospace";
        div.style.textAlign = "left";

        // IMPORTANT : On affiche les clés exactes renvoyées par ton backend Alchemy
        // (Exemple : contractAddress / tokenAddress et balance / hexBalance selon la structure d'Alchemy)
        const adresseContrat = token.contractAddress || token.token_address || "Adresse introuvable";
        const balanceHexa = token.balance || token.hex_balance || "Balance introuvable";

        div.innerHTML = `
            <div><strong>Contrat :</strong> ${adresseContrat}</div>
            <div><strong>Balance (Hex) :</strong> ${balanceHexa}</div>
            <div style="color: gray; font-size: 10px;">Réseau: ${token.chain.toUpperCase()}</div>
        `;

        dustContainer.appendChild(div);
    });
}
