---
'@vt-labs/form': minor
---

New `FileField` for a file or a photo, held in the form as a `File` (or `File[]` with `multiple`). The user chooses with a button or drops a file on the field. `accept` and `maxBytes` are checked on the way in: a refused file never reaches the value, and the field says why through the new `fileTooLarge` and `fileWrongType` labels. `variant="photo"` shows a square preview with Replace and Remove, and `onEdit` adds an Edit button that hands the current file to your editor (such as `@vt-labs/image-editor`) and keeps the file it resolves, or the original on `null`. The field never uploads; send the file from your submit handler. Other new labels: `chooseFile`, `dropFile`, `replaceFile`, `removeFile`, `choosePhoto`, `editPhoto`, `replacePhoto`, `removePhoto` and `fileSize`. A refused file shows its message without blocking submit, since the value still holds only what was accepted.
