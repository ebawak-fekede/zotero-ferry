// Zotero 10 APIs not yet covered by zotero-types.
declare namespace Zotero {
  namespace DataObject {
    interface SaveOptions {
      skipEditCheck?: boolean;
    }
  }
  namespace Relations {
    /** Repoint inbound relations when an attachment is replaced. */
    function copyObjectSubjectRelations(from: Item, to: Item): Promise<void>;
  }
}
