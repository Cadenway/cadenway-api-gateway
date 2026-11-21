# Profile media

Coordinates the nine public avatar and organization logo operations. Identity owns the account
avatar reference, Organization owns its logo reference and current membership, and Storage owns
signed image transfers and private PNG derivatives.

For uploads, the owner reserves the identifier and original expiry before Storage signs the form.
A pending reservation is prepared in Storage before its owner commits the image. A committed
reservation goes directly to the owner, which decides whether the equivalent replay is still valid.
Deletes delegate to the owner and return its current ETag.

Account reads resolve the current Identity reference. Member reads first perform a live member
lookup in the selected organization, then resolve that account's current Identity reference.
Organization reads resolve live access and the current logo in the same Organization response.
Only then does the gateway retrieve the bounded PNG from Storage. Account-owned operations use
unscoped account claims for Storage. Directory and organization operations use the verified
organization context.

## Public entry points

This module exposes its HTTP routes only.
