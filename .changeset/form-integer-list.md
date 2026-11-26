---
'@vt-labs/form': minor
---

New `IntegerListField` for a list of whole numbers held as `number[]`, such as reminder offsets. Comma, `Enter` or blur commits an entry as a chip, a pasted "15, 30, 60" becomes three chips, and it takes `min`, `max`, `unit`, `allowDuplicates` and `sorted`. An entry that is not a whole number, is out of range or repeats stays on screen as an error chip, is kept out of the value, and blocks submit until it is fixed or removed. New labels: `integerListInvalid`, `integerListDuplicate`, `integerListOutOfRange` and `removeEntry`.
