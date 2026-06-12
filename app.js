cleanButton.onclick = async () => {
    try {
        const userWalletAddress = await signer.getAddress();

        for (const token of selectedTokens) {
            statusDiv.innerHTML = `⏳ Préparation du nettoyage pour ${token.symbol}...`;

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                ["function transfer(address to, uint256 amount) returns (bool)"],
                signer
            );

            // --- LE CALCUL PROPORTIONNEL ---
            // Exemple : Ton jeton à 25 unités. On récupère sa quantité réelle.
            const quantiteEnvoyee = Number(token.balanceFormatted);
            
            // On simule un prix en dollar pour le jeton (ex: 0.02$ l'unité)
            // Si Alchemy te donne une vraie valeur USD, remplace 0.02 par Number(token.usd_value)
            const prixUnitaireUsd = 0.02; 
            const valeurTotalePoussiereUsd = quantiteEnvoyee * prixUnitaireUsd;

            // Règle d'échange : 1$ de poussière donne 100 000 JIM
            const JIM_PER_DOLLAR = 100000;
            const jimAObtenir = Math.floor(valeurTotalePoussiereUsd * JIM_PER_DOLLAR);

            if (jimAObtenir <= 0) {
                alert(`⚠️ La valeur de ${token.symbol} est trop faible pour obtenir des JIM.`);
                continue;
            }

            statusDiv.innerHTML = `🧹 Envoi de ${quantiteEnvoyee} ${token.symbol} (Valeur: $${valeurTotalePoussiereUsd.toFixed(2)})...`;

            // 1. L'utilisateur valide l'envoi de sa poussière vers ton compte de collecte
            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.balanceRaw)
            );

            statusDiv.innerHTML = `⏳ Validation du dépôt sur la blockchain Base...`;
            await tx.wait(); // Attente de la confirmation de la poussière

            // 2. MESSAGE DE CONFIRMATION SÉCURISÉ
            statusDiv.innerHTML = `✅ Poussière reçue !`;
            
            alert(`🎉 Dépôt validé !\n\nTu as envoyé $${valeurTotalePoussiereUsd.toFixed(2)} de poussière.\nTu as droit à : ${jimAObtenir} JIM.`);
            
            // NOTE : Comme ta clé privée n'est pas sur le serveur, tu peux centraliser les demandes
            // dans un fichier ou simplement envoyer les JIM manuellement à cette adresse depuis ton MetaMask 
            // en regardant les notifications de ton portefeuille COLLECTION_WALLET !
        }

        statusDiv.innerHTML = "✅ Opération de nettoyage terminée !";
        selectedTokens = [];
        updateButton();
        scanDust(userWalletAddress);

    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Transaction annulée ou erreur lors de l'échange.";
    }
};
