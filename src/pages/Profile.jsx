import { Link, useNavigate } from "react-router-dom";
import ethLogo from "../assets/ethIndia.svg";
import Header from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github,
  Lock,
  MoreVertical,
  ShieldEllipsis,
  Upload,
  UserRoundCog,
  View,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ethers } from "ethers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVariable } from "@/lib/storage";
import lighthouse, { shareFile } from "@lighthouse-web3/sdk";
import sendNotification from "@/utils/sendPushWeb3Notificatiobs";
import { ClipLoader } from "react-spinners";

function Profile() {
  const [pastRequests, setPastRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const signer = useVariable((state) => state.signer);
  const apiKey = useVariable((state) => state.apiKey);
  const [userFiles, setUserFiles] = useState([]);
  const [otherUserFiles, setOtherUserFiles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const [mimeType, setMimeType] = useState();
  const [loading, setLoading] = useState(false);

  const signAuthMessage = async () => {
    const address = await signer.getAddress();
    const messageRequested = (await lighthouse.getAuthMessage(address)).data
      .message;
    const signedMessage = await signer.signMessage(messageRequested);
    return {
      signedMessage: signedMessage,
      publicKey: address,
    };
  };

  const handleFileChange = async (event) => {
    setSelectedFile(URL.createObjectURL(event.target.files[0]));
    const signerAddress = await signer.getAddress();
    console.log("tr signer", signer, signerAddress);
    const signedMessage = await signAuthMessage();
    let file = event.target.files;
    console.log(file, apiKey, signerAddress, signedMessage.signedMessage);
    // Upload file with encryption
    const output = await lighthouse.uploadEncrypted(
      file,
      apiKey,
      signerAddress,
      signedMessage.signedMessage
    );
    console.log("Encrypted File Status:", output);
    getUploads();
  };
  const navigate = useNavigate();
  const walletAddress = useVariable((state) => state.walletAddress);
  const contract = useVariable((state) => state.contract);
  const handleFileUpload = () => {};
  const fetchUserFiles = async (userAddress, cid) => {
    try {
      // Wait for all promises to resolve
      const records = await contract.getSentRequests();

      const docsPromises = records.map(async (event) => {
        let { cid, docName, fileSize, docOwner } = event;
        // if (!requestSent || acknowledgment) return;
        // let fileSize;
        const request = await contract.requestAccess(walletAddress, cid);
        let { requestSender, _, requestSent, acknowledgment } = request;
        console.log(request, docName, fileSize);
        fileSize = parseInt(fileSize._hex.toString());
        console.log(cid, acknowledgment, docName);
        return { cid, docName, docOwner, fileSize, acknowledgment };
      });

      // Wait for all promises to resolve
      const docs = await Promise.all(docsPromises);

      // Wait for all promises to resolve
      // const docs = pendingRequests();
      console.log(docs);
      setPastRequests(docs);
      console.log(docs);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      let records = await contract.getPendingRequests();
      // records=[...records];
      console.log(records);
      const docsPromises = records.map(async (event) => {
        const { requestSender, cid, requestSent, acknowledgment } = event;
        if (!requestSent || acknowledgment) return;

        const fileData = await contract.documents(cid);
        let { _a, docName, fileSize, _b } = fileData;
        console.log(fileData, docName, fileSize);
        fileSize = parseInt(fileSize._hex.toString());
        console.log(fileSize);

        return { cid, docName, requestSender, fileSize };
      });

      // Wait for all promises to resolve
      const docs = await Promise.all(docsPromises);

      // Wait for all promises to resolve
      // const docs = pendingRequests();
      console.log(docs);
      setPendingRequests(docs);
      console.log(docs);
    } catch (error) {
      console.log(error);
    }
  };
  async function handleApprove(cid, requestSender) {
    try {
      setIsAccepting(true);
      console.log(cid, requestSender);
      await (await contract.approveRequest(cid, requestSender)).wait();
      await fetchPendingRequests();
      const fileData = await contract.documents(cid);
      await AcceptRequest(fileData, requestSender);
      setIsAccepting(false);
    } catch (error) {
      console.log("Can't accept currently", error);
    }
  }
  async function handleReject(cid, requestSender) {
    try {
      setIsRejecting(true);
      console.log(cid, requestSender);
      await (await contract.rejectRequest(cid, requestSender)).wait();
      await fetchPendingRequests();
      setIsRejecting(false);
    } catch (error) {
      console.log("Can't accept currently");
    }
  }
  useEffect(() => {
    if (!walletAddress || !contract) {
      alert("connect wallet");
      navigate("/");
    }
    fetchUserFiles();
    fetchPendingRequests();
  }, []);

  const decryptFile = async (fileCid) => {
    try {
      const getFileInfo = await lighthouse.getFileInfo(fileCid);
      const response = await lighthouse.getAccessConditions(fileCid);
      console.log(response);
      const fileType = getFileInfo.data.mimeType;
      const { publicKey, signedMessage } = await signAuthMessage();
      const keyObject = await lighthouse.fetchEncryptionKey(
        fileCid,
        publicKey,
        signedMessage
      );

      console.log("0", fileCid, fileType);
      const decrypted = await lighthouse.decryptFile(
        fileCid,
        keyObject.data.key,
        fileType
      );
      console.log(decrypted);
      const url = URL.createObjectURL(decrypted);
      return url;
    } catch (error) {
      console.error("Error decrypting file:", error);
      return null;
    }
  };

  const handleViewFile = async (cid) => {
    try {
      setLoading(true);
      const fileUrl = await decryptFile(cid);
      setSelectedFileUrl(fileUrl);
      const getFileInfo = await lighthouse.getFileInfo(cid);
      console.log("getFileInfo", getFileInfo);
      setMimeType(getFileInfo?.data?.mimeType);
      setIsModalOpen(true);
      setLoading(false);
    } catch (error) {
      console.error("Error decrypting file:", error);
      setLoading(false);
    }
  };

  const getUploads = async () => {
    try {
      const response = await lighthouse.getUploads(apiKey);
      console.log("response", response);
      const publicKey = await signer.getAddress();

      // Filter the files uploaded by the current user
      const userUploadedFiles = response.data.fileList.filter(
        (file) => file.publicKey.toLowerCase() === publicKey.toLowerCase()
      );

      console.log("userUploadedFiles", userUploadedFiles);
      setUserFiles(userUploadedFiles);

      // Check for files shared with the current user
      const sharedFilesPromises = response.data.fileList.map(async (file) => {
        const accessResponse = await lighthouse.getAccessConditions(file.cid);
        if (accessResponse.data.sharedTo.includes(publicKey)) {
          return file;
        }
        return null;
      });

      const sharedFiles = (await Promise.all(sharedFilesPromises)).filter(
        (file) => file !== null
      );

      console.log("shared", sharedFiles);
      setOtherUserFiles(sharedFiles);
    } catch (error) {
      console.error("Error fetching uploads:", error);
    }
  };

  useEffect(() => {
    getUploads();
  }, []);

  // const FileModal = () => {
  //   if (!isModalOpen) return null;

  //   return (
  //     <div className="modal-overlay" onClick={closeModal}> {/* Optionally close modal on overlay click */}
  //       <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent click inside modal from closing it */}
  //         <button onClick={closeModal} style={{color: "black"}}>Close</button>
  //         <img src={selectedFileUrl} alt="Decrypted File" />
  //       </div>
  //     </div>
  //   );
  // };

  const FileModal = () => {
    if (!isModalOpen || !selectedFileUrl) return null;

    let content;
    const fileType = mimeType; //getMimeType(selectedFileUrl);
    console.log("fileType", fileType);
    if (fileType.startsWith("image/")) {
      content = <img src={selectedFileUrl} alt="File Content" />;
    } else if (fileType === "application/pdf") {
      content = (
        <iframe
          src={selectedFileUrl}
          style={{ width: "100%", height: "300px" }}
        ></iframe>
      );
    } else if (fileType.startsWith("text/")) {
      content = (
        <iframe
          src={selectedFileUrl}
          style={{ width: "100%", height: "200px" }}
        ></iframe>
      );
    } else {
      content = <p>Unsupported file format</p>;
    }

    return (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsModalOpen(false)}
            style={{ color: "black" }}
          >
            Close
          </button>
          {content}
        </div>
      </div>
    );
  };

  const AcceptRequest = async (doc, requester) => {
    console.log("doc", doc);
    console.log("doc", doc[0]);
    const accessResponse = await lighthouse.getAccessConditions(doc.cid);
    console.log("accessResponse", accessResponse);
    let userAddressArray =
      accessResponse.data?.sharedTo?.length > 0
        ? accessResponse.data?.shared
        : [];
    console.log("userAddressArray", userAddressArray, requester);
    userAddressArray.push(requester);
    console.log(userAddressArray);
    let shareFileForReq = await shareFile(doc?.cid, userAddressArray);
    console.log("shareFileForReq", shareFileForReq);
  };

  // const testSendNotification = async (receiverPublicKeys) => {
  //   const title = "File Approved";
  //   const body = "File has appoved to accout. Use it now.";

  //   await sendNotification(receiverPublicKeys, title, body, signer);
  // };

  const shareFile = async (fileCid, userAddressArray) => {
    try {
      // CID of the encrypted file that you want to share
      // CID is generated by uploading a file with encryption
      // Only the owner of the file can share it with another wallet address

      const cid = fileCid;
      // CID: Unique identifier for content on IPFS.
      const getFileInfo = await lighthouse.getFileInfo(cid);
      console.log("getFileInfo", getFileInfo);

      const receiverPublicKey = userAddressArray;

      const signedMessage = await signAuthMessage();

      console.log("signedMessage", signedMessage);

      console.log(
        signedMessage.publicKey,
        receiverPublicKey,
        cid,
        signedMessage.signedMessage
      );
      const shareResponse = await lighthouse.shareFile(
        signedMessage.publicKey,
        receiverPublicKey,
        cid,
        signedMessage.signedMessage
      );
      // ShareFile: Lighthouse function to securely share your file.

      console.log(shareResponse);
      //testSendNotification();

      return shareResponse;
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <>
      <header className="flex z-[999] items-center border-b-2 pb-4 backdrop-blur-xl fixed top-0 left-0 right-0 pl-[4rem] pr-[4rem] p-4 dark justify-between">
        <div className="flex items-center justify-between w-full">
          <Link to={"/"}>
            <span className="text-[1.5rem] tracking-wide font-bold">
              VeriSecure
            </span>
          </Link>
          <div className="flex gap-4">
            <Link to={"/profile?action=upload"}>
              {/* <Button className="flex gap-2">
                <Upload />
                Upload Files
              </Button> */}
            </Link>
            <Link to="/profile">
              <Button variant="outline" className="flex gap-2">
                <UserRoundCog />
                Your Profile
              </Button>
            </Link>
          </div>
          <div className="flex gap-4">
            <Link to={"/profile?action=upload"}>
              {/* <Button className="flex gap-2">
                <Upload />
                Upload Files
              </Button> */}
            </Link>
            <Link to="/myfiles">
              <Button variant="outline" className="flex gap-2">
                <UserRoundCog />
                My Files
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full h-full flex flex-col mt-[4rem] justify-center items-center ml-6">
        <div className="p-2">
          {loading ? <ClipLoader color="white" size={40} /> : <></>}
        </div>
        {/* <div className="min-w-screen justify-center flex p-[2rem]  w-full max-w-[1280px] h-full items-center">
          <Card className="p-6 items-center flex flex-col gap-4 justify-center w-full">
            <Label htmlFor="picture" className="text-[1.25rem]">
              Choose the file
            </Label>
            <Input
              className="text-center"
              id="picture"
              type="file"
              onChange={handleFileChange}
            />
            {selectedFile && (
              <div className="flex flex-col gap-4">
                <img src={selectedFile} alt="Selected file" className="mt-4" />
                <Button onClick={() => handleFileUpload()}>Upload File</Button>
              </div>
            )}
          </Card>
        </div> */}
        <div className="flex w-full max-w-[1280px] gap-4">
          <div className="w-full flex flex-col gap-4 max-w-[1280px]">
            <span className="text-[2rem] font-bold">Past requests</span>
            {/* {Array.from({ length: 10 }).map((_, i) => ( */}
            {pastRequests.map((doc, i) => (
              <>
                <Card
                  key={i}
                  className={cn(
                    "flex gap-4 p-2 pl-6 pr-6 w-full justify-between max-w-[600px] items-center"
                  )}
                >
                  <div className="flex gap-4 items-center">
                    <img
                      className={cn("h-10 w-10 rounded-full")}
                      src="https://i.pravatar.cc/300"
                    ></img>
                    <div className="flex flex-col">
                      <span className={cn("text-[1.5rem] font-bold")}>
                        {doc?.docName}
                      </span>
                      <div className="flex gap-8">
                        <span className="text-[0.8rem] opacity-80">
                          {doc?.docOwner}
                        </span>
                        <span className="text-[0.8rem] opacity-80">
                          Size :- {parseInt(doc?.fileSize)} KB
                        </span>
                      </div>
                    </div>
                    {doc?.acknowledgment ? (
                      <button
                        onClick={() => handleViewFile(doc?.cid)}
                        className="view-button"
                      >
                        View
                      </button>
                    ) : (
                      <></>
                    )}
                  </div>
                </Card>
              </>
            ))}
          </div>

          <div className="w-full flex flex-col gap-4 max-w-[1280px]">
            <span className="text-[2rem] font-bold">Pending Approvals</span>
            {/* {Array.from({ length: 10 }).map((_, i) => ( */}
            {pendingRequests.map((doc, i) => (
              <>
                <Card
                  key={i}
                  className={cn(
                    "flex gap-4 p-2 pl-6 pr-6 w-full justify-between max-w-[600px] items-center"
                  )}
                >
                  <div className="flex gap-4 items-center">
                    <img
                      className={cn("h-10 w-10 rounded-full")}
                      src="https://i.pravatar.cc/300"
                    ></img>
                    <div className="flex flex-col">
                      <span className={cn("text-[1.5rem] font-bold")}>
                        {doc?.docName}
                      </span>
                      <div className="flex gap-8">
                        <span className="text-[0.8rem] opacity-80">
                          {doc?.requestSender}
                        </span>
                        <span className="text-[0.8rem] opacity-80">
                          Size :- {parseInt(doc?.fileSize)} KB
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Popover>
                      <PopoverTrigger>
                        <MoreVertical />
                      </PopoverTrigger>
                      <PopoverContent className="flex gap-2 flex-col">
                        {/* <Button>Delete</Button> */}
                        <Button
                          disabled={isRejecting}
                          onClick={() =>
                            handleApprove(doc?.cid, doc?.requestSender)
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          disabled={isAccepting}
                          onClick={() =>
                            handleReject(doc?.cid, doc?.requestSender)
                          }
                        >
                          Reject
                        </Button>
                        {/* <Button>Share</Button> */}
                      </PopoverContent>
                    </Popover>
                    {/* <Button variant="outline">Verify</Button> */}
                  </div>
                </Card>
              </>
            ))}
          </div>
        </div>
      </div>
      <FileModal />
    </>
  );
}

export default Profile;
