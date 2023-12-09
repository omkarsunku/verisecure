
const ethers = require('ethers')
const lighthouse = require('@lighthouse-web3/sdk')

const signAuthMessage = async (publicKey, privateKey) => {
    const provider = new ethers.JsonRpcProvider();
    const signer = new ethers.Wallet(privateKey, provider);
    const messageRequested = (await lighthouse.getAuthMessage(publicKey)).data.message;
    const signedMessage = await signer.signMessage(messageRequested);
    return signedMessage;
}

const shareFile = async () => {
    try {
        // CID of the encrypted file that you want to share
        // CID is generated by uploading a file with encryption
        // Only the owner of the file can share it with another wallet address

        const cid = "QmTJrWjLY9ARCwxYqJwc4Zu8Dzm3fXakAgVvdtgc24X3BU";
        // CID: Unique identifier for content on IPFS.
        const getFileInfo = await lighthouse.getFileInfo(cid);
        console.log("getFileInfo", getFileInfo);

        const publicKey = "0x37e401D92961908046c2672A89a780bFaD2FA927";

        const privateKey = "475d684b486e10bacd57dc67ac6b0ab566ab0b3235c1acda07fa3bb3bb8eb425" //process.env.PRIVATE_KEY;
        console.log("privateKey", privateKey)
        // PrivateKey: Secured key for authentication, stored away from the codebase.

        const receiverPublicKey = ["0xaf8dAa403ddB2b0742BfABE44214Fa8fBe69DCAB"];

        const signedMessage = await signAuthMessage(publicKey, privateKey);

        console.log("signedMessage", signedMessage)

        const shareResponse = await lighthouse.shareFile(
            publicKey,
            receiverPublicKey,
            cid,
            signedMessage
        );
        // ShareFile: Lighthouse function to securely share your file.

        console.log(shareResponse);

    } catch (error) {
        console.log(error)
    }
}

shareFile()

/* Sample Response      
{
  data: {
    cid: 'QmXhvRaWPpEXgFzqBLkq75EcE79oghqE3pGtkmiU21LnPf',
    shareTo: [ '0xaf8dAa403ddB2b0742BfABE44214Fa8fBe69DCAB' ],
    status: 'Success'
  }
}
*/

/*
{
  data: {
    cid: 'QmTJrWjLY9ARCwxYqJwc4Zu8Dzm3fXakAgVvdtgc24X3BU',
    shareTo: [ '0xaf8dAa403ddB2b0742BfABE44214Fa8fBe69DCAB' ],
    status: 'Success'
  }
}
*/