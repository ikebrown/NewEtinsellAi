///blockchain/contracts/ProfileBadgeNFT.sosolidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProfileBadgeNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("Etincel Verification Badge", "ETIV") Ownable(msg.sender) {}

    function mintVerificationBadge(address to, string memory uri) 
        public 
        onlyOwner 
        returns (uint256) 
    {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}