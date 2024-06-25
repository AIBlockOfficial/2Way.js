export enum ISuccessAll {
    IErrorInternal,
}

export enum ISuccessNetwork {
    FetchWalletInfo = 'Wallet info successfully fetched',
    ExportKeypairs = 'Key-pairs successfully exported',
    ImportKeypairs = 'Key-pairs successfully imported',
    GetPaymentAddress = 'New payment address generated',
    GetDebugData = 'Debug data successfully retrieved',
    GetLatestBlock = 'Current mining block successfully retrieved',
    UTXOAddressesRetrieved = 'UTXO addresses successfully retrieved',
    DataBaseItemsRetrieved = 'Database item(s) successfully retrieved',
    PaymentProcessing = 'Payment processing',
    IpPaymentProcessing = 'IP payment processing',
    DonationRequestSent = 'Donation request sent',
    RunningTotalUpdated = 'Running total updated',
    FetchBalance = 'Balance successfully fetched',
    FetchPendingTransactions = 'Pending transactions successfully fetched',
    CreateItemAssets = 'Item asset(s) created',
    CreateTransactions = 'Transaction(s) processing',
    ChangeWalletPassphrase = 'Passphrase changed successfully',
    ConstructAddress = 'Address successfully constructed',
}

export enum ISuccessInternal {
    ClientInitialized = 'Client initialized',
    MessageSigned = 'Successfully signed message',
    MessageVirified = 'Successfully verified message',
    TwoWayPaymentProcessing = '2-Way payment processing',
    Pending2WPaymentsFetched = 'Succesfully fetched pending 2 way transactions',
    AddressesReconstructed = 'Addresses have successfully been reconstructed',
    NewAddressGenerated = 'Successfully generated new address',
    SeedPhraseObtained = 'Successfully obtained seed phrase',
    MasterKeyObtained = 'Successfully obtained master key',
    KeypairDecrypted = 'Successfully decrypted key-pair',
    KeypairSaved = 'Successfully saved key-pair to local storage',
    KeypairObtained = 'Successfully retreived key-pair from local storage',
    RespondedTo2WPayment = 'Successfully responded to 2 way payment',
}
