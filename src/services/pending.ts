    /**
     * Fetch pending item-based payments from the valence server
     *
     * @param {IKeypairEncrypted[]} allKeypairs - A list of all existing key-pairs (encrypted)
     * @param {ICreateTransactionEncrypted[]} allEncryptedTxs - A list of all existing saved transactions (encrypted)
     * @return {*}  {Promise<IClientResponse>}
     * @memberof Wallet
     */
    public async fetchPending2WayPayments(
        allKeypairs: IKeypairEncrypted[],
        allEncryptedTxs: ICreateTransactionEncrypted[],
    ): Promise < IClientResponse > {
        try {
            if(!this.mempoolHost || !this.keyMgmt || !this.mempoolRoutesPoW)
            throw new Error(IErrorInternal.ClientNotInitialized);
            if(!this.valenceHost) throw new Error(IErrorInternal.ValenceNotInitialized);

            // Generate a key-pair map
            const [allAddresses, keyPairMap] = throwIfErr(
                this.keyMgmt.getAllAddressesAndKeypairMap(allKeypairs),
            );

            // DRUID - Encrypted Transaction Mapping
            const encryptedTxMap = new Map<string, ICreateTransactionEncrypted>();
            allEncryptedTxs.forEach((tx) => encryptedTxMap.set(tx.druid, tx));

            const pendingValence: IRequestValenceGetBody[] = allAddresses
                .map((address) => {
                    if (!this.keyMgmt) return null;
                    const keyPair = keyPairMap.get(address);
                    if (!keyPair) return null;
                    return generateValenceGetBody(address, keyPair);
                })
                .filter((input): input is IRequestValenceGetBody => !!input); /* Filter array */

            console.log(pendingValence)

            const kp = throwIfErr(this.keyMgmt.decryptKeypair(allKeypairs[0]));
            const sendHeaders = generateVerificationHeaders(allAddresses[0], kp)

            console.log(sendHeaders)

            // Get all pending RB transactions
            let responseData = await axios
                .get<IResponseValence<IPendingIbTxDetails>>(
                    `${this.valenceHost}${IAPIRoute.ValenceGet}`,
                    sendHeaders
                )
                .then((response) => {
                    return response.data;
                })
                .catch(async (error) => {
                    if (error instanceof Error) throw new Error(error.message);
                    else throw new Error(`${error}`);
                });

            // NB: Validate item-based data and remove garbage entries
            responseData = filterValidValenceData(responseData);

            // Get accepted and rejected item-based transactions
            const rbDataToDelete: IRequestValenceDelBody[] = [];
            const [acceptedIbTxs, rejectedIbTxs] = [
                throwIfErr(
                    filterValenceDataForPredicates(responseData, { status: 'accepted' }, true),
                ),
                throwIfErr(
                    filterValenceDataForPredicates(responseData, { status: 'rejected' }, true),
                ),
            ];

            // We have accepted item-based payments to send to mempool
            if(Object.entries(acceptedIbTxs).length > 0) {
    const transactionsToSend: ICreateTransaction[] = [];
    for (const acceptedTx of Object.values(acceptedIbTxs)) {
        // Decrypt transaction stored along with DRUID value
        const encryptedTx = encryptedTxMap.get(acceptedTx.value.druid);
        if (!encryptedTx) throw new Error(IErrorInternal.InvalidDRUIDProvided);
        const decryptedTransaction = throwIfErr(
            this.keyMgmt.decryptTransaction(encryptedTx),
        );

        // Ensure this transaction is actually a 2 way transaction
        if (!decryptedTransaction.druid_info)
            throw new Error(IErrorInternal.NoDRUIDValues);

        // Set `from` address value from recipient by setting the entire expectation to the one received from the valence server
        decryptedTransaction.druid_info.expectations[0] =
            acceptedTx.value.senderExpectation; /* There should be only one expectation in a item-based payment */

        // Add to list of transactions to send to mempool node
        transactionsToSend.push(decryptedTransaction);
        const keyPair = keyPairMap.get(acceptedTx.value.senderExpectation.to);
        if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

        rbDataToDelete.push(
            generateValenceDelBody(
                acceptedTx.value.senderExpectation.to,
                acceptedTx.value.receiverExpectation.to,
                keyPair,
            ),
        );
    }

    // Generate the required headers
    const headers = this.getRequestIdAndNonceHeadersForRoute(
        this.mempoolRoutesPoW,
        IAPIRoute.CreateTransactions,
    );

    // Send transactions to mempool for processing
    await axios
        .post<INetworkResponse>(
            // NB: Make sure we use the same mempool host when initializing all item-based payments
            `${this.mempoolHost}${IAPIRoute.CreateTransactions}`,
            transactionsToSend,
            { ...headers, validateStatus: () => true },
        )
        .then(async (response) => {
            if (castAPIStatus(response.data.status) === 'error')
                throw new Error(response.data.reason);
        })
        .catch(async (error) => {
            if (error instanceof Error) throw new Error(error.message);
            else throw new Error(`${error}`);
        });
}

// Add rejected item-based transactions to delete list as well
if (Object.entries(rejectedIbTxs).length > 0) {
    for (const rejectedTx of Object.values(rejectedIbTxs)) {
        const keyPair = keyPairMap.get(rejectedTx.value.senderExpectation.to);
        if (!keyPair) throw new Error(IErrorInternal.UnableToGetKeypair);

        rbDataToDelete.push(
            generateValenceDelBody(
                rejectedTx.value.senderExpectation.to,
                rejectedTx.value.receiverExpectation.to,
                keyPair,
            ),
        );
    }
}

// Delete item-based data from valence since the information is no longer relevant (accepted and rejected txs)
if (rbDataToDelete.length > 0)
    await axios
        .post(`${this.valenceHost}${IAPIRoute.ValenceDel}`, rbDataToDelete)
        .catch(async (error) => {
            if (error instanceof Error) throw new Error(error.message);
            else throw new Error(`${error}`);
        });

return {
    status: 'success',
    reason: ISuccessInternal.PendingIbPaymentsFetched,
    content: {
        fetchPendingIbResponse: responseData,
    },
} as IClientResponse;
        } catch (error) {
    return {
        status: 'error',
        reason: `${error}`,
    } as IClientResponse;
}
