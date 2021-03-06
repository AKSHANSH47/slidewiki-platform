import {BaseStore} from 'fluxible/addons';
import Immutable from 'immutable';

class DeckTreeStore extends BaseStore {
    constructor(dispatcher) {
        super(dispatcher);
        //keeps the status of currently selected node
        this.selector = Immutable.fromJS({});
        this.prevSelector = Immutable.fromJS({});
        this.nextSelector = Immutable.fromJS({});
        this.deckTree = Immutable.fromJS({});
        this.flatTree = Immutable.fromJS({});
        this.error = 0;
        //used to check if the selector is valid and refers to a node that belongs to this deck tree
        this.isSelectorValid = true;
        this.revisionId = null;
        this.latestRevisionId = null;
    }
    updateDeckTree(payload) {
        this.isSelectorValid = true;
        this.selector = Immutable.fromJS(payload.selector);
        //add path to tree nodes
        this.deckTree = Immutable.fromJS(this.makePathForTree(payload.deckTree, []));
        this.flatTree = Immutable.fromJS(this.flattenTree(this.deckTree));
        let selectedNodeIndex = this.makeImmSelectorFromPath(this.selector.get('spath'));

        //set a default path in case of no path or when path does not exist
        if(!payload.selector.spath || !this.deckTree.hasIn(selectedNodeIndex)){
            this.selector = this.selector.setIn(['spath'], this.generateASelectorPath(this.flatTree, this.selector));
        }
        //update the selected node index
        selectedNodeIndex = this.makeImmSelectorFromPath(this.selector.get('spath'));

        //update the selected node in tree
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('selected', (val) => true));

        //check that the spath (actually only the positions specified in the spath are used) corresponds to the node specified
        // by stype and sid
        let selectedNode = this.getImmNodeFromImmSelector(selectedNodeIndex);
        if (selectedNode.get('type') !== this.selector.get('stype') || selectedNode.get('id').split('-')[0] !== this.selector.get('sid').split('-')[0]){
            this.isSelectorValid = false;
        }

        //prepare next and prev node selector
        this.updatePrevNextSelectors();
        //reset error state
        this.error = 0;
        this.revisionId = payload.deckTree.revisionId;
        this.latestRevisionId = payload.deckTree.latestRevisionId;
        this.emitChange();
    }
    updatePrevNextSelectors() {
        this.prevSelector = this.makeSelectorFromNode(this.findPrevNode(this.flatTree, this.selector));
        this.nextSelector = this.makeSelectorFromNode(this.findNextNode(this.flatTree, this.selector));
    }
    //deckTree: original deckTree from service without path
    //path: array of binary id:position
    makePathForTree(deckTree, path) {
        let nodePath = this.makeSelectorPathString(path);
        let newTree = {id: deckTree.id, title: deckTree.title, type: deckTree.type, path: nodePath, selected: false, editable: false, onAction: 0};
        if (deckTree.type === 'deck') {
            newTree.children = [];
            newTree.expanded = true;
            deckTree.children.forEach((item, index) => {
                newTree.children.push(this.makePathForTree(item, path.concat([[item.id, index + 1]])) );
            });
        }
        return newTree;
    }
    //deckTree: immutable deckTree with path strings -> it is used to update the path
    //path: array of binary id:position
    updatePathForImmTree(deckTree, path) {
        let nodePath = this.makeSelectorPathString(path);
        let newTree = {id: deckTree.get('id'), title: deckTree.get('title'), type: deckTree.get('type'), path: nodePath, selected: deckTree.get('selected'), editable: deckTree.get('editable'), onAction: deckTree.get('onAction')};
        if (deckTree.get('type') === 'deck') {
            newTree.children = [];
            newTree.expanded = deckTree.get('expanded');
            deckTree.get('children').forEach((item, index) => {
                newTree.children.push(this.updatePathForImmTree(item, path.concat([[item.get('id'), index + 1]])) );
            });
        }
        return Immutable.fromJS(newTree);
    }
    //flat tree is used to avoid complex recursive functions on tree
    //it is a trade off: updating the tree needs this to be synchronized
    flattenTree(deckTree) {
        let list = [];
        list.push({id: deckTree.get('id'), title: deckTree.get('title'), type: deckTree.get('type'), path: deckTree.get('path')});
        if (deckTree.get('type') === 'deck') {
            deckTree.get('children').forEach((item, index) => {
                list = list.concat(this.flattenTree(item));
            });
        }
        return list;
    }
    //generates a selector path if needed (uses flatTree search)
    //returns the first occurance
    generateASelectorPath(flatTree, selector) {
        let spath = '';
        for (let i=0; i < flatTree.size; i++) {
            if ((flatTree.get(i).get('type') === selector.get('stype')) && (parseInt(flatTree.get(i).get('id')) === parseInt(selector.get('sid')))) {
                spath = flatTree.get(i).get('path');
                return spath;
            }
        }
        return spath;
    }
    //used for recursive path building
    makePathArrFromString(pathStr) {
        let out = [];
        let arr = pathStr.split(';');
        arr.forEach((element, index) => {
            out.push(element.split(':'));
        });
        return out;
    }
    //parses the nodePath and builds a selector path for navigation
    makeSelectorPathString(nodePath) {
        let out = [], slectorPath = '';
        nodePath.forEach((element, index) => {
            out.push(element.join(':'));
        });
        slectorPath = out.join(';');
        return slectorPath;
    }
    //e.x. path: 68:3;685:2;691:2
    makeImmSelectorFromPath(path) {
        if(!path){
            //in case of root deck selected
            return [];
        }
        let out=['children'];
        let tmp, arr = path.split(';');
        arr.forEach((item, index) => {
            tmp = item.split(':');
            out.push(parseInt(tmp[1]-1));
            if(index !== (arr.length - 1)){
                //last item is always a slide, remaining are decks
                out.push('children');
            }
        });
        return out;
    }
    calculateNodeAbsPosition(flatTree, spath){
        let position = 0;
        for (let i=0; i < flatTree.size; i++) {
            if (flatTree.get(i).get('path') === spath) {
                position = i;
                return i;
            }
        }
        return position;
    }
    findPrevNode(flatTree, selector) {
        let node;
        //we consider expansion of nodes to select the next selector
        let selectedNodeIndex= this.makeImmSelectorFromPath(selector.get('spath'));
        let selectedNode= this.getImmNodeFromImmSelector(selectedNodeIndex);
        let lastItem = selectedNodeIndex.splice(-1,1);
        let siblingsList = this.getImmNodeFromImmSelector(selectedNodeIndex);
        if((lastItem[0] - 1) >=0){
            selectedNodeIndex.push(lastItem[0] - 1);
            let testNode = this.getImmNodeFromImmSelector(selectedNodeIndex);
            if(testNode.get('type') === 'deck' && !testNode.get('expanded')){
                node = testNode;
            }
        }
        if(!node){
            //we use the flat tree for normal case without considering expansion of nodes
            let position = this.calculateNodeAbsPosition(flatTree, selector.get('spath'));
            //do not select the root deck node
            if(position === 0){
                node = flatTree.get(0);
            }else{
                node = flatTree.get(position  - 1);
            }
        }
        return node;
    }
    findNextNode(flatTree, selector) {
        let node;
        let selectedNodeIndex= this.makeImmSelectorFromPath(selector.get('spath'));
        let selectedNode= this.getImmNodeFromImmSelector(selectedNodeIndex);
        if(selectedNode.get('type') === 'deck' && !selectedNode.get('expanded')){
            let lastItem = selectedNodeIndex.splice(-1,1);
            let siblingsList = this.getImmNodeFromImmSelector(selectedNodeIndex);
            if((lastItem[0] + 1) <= (siblingsList.size -1)){
                //it means there exists a last nodeIndex
                selectedNodeIndex.push(lastItem[0] + 1);
                node = this.getImmNodeFromImmSelector(selectedNodeIndex);
            }else{
                //stop in the node
                node = selectedNode;
            }
        }else{
            let position = this.calculateNodeAbsPosition(flatTree, selector.get('spath'));
            node = flatTree.get(position + 1);
            if(!node){
                node = selectedNode;
            }
        }
        return node;
    }
    makeSelectorFromNode(node) {
        return Immutable.fromJS({'id': this.deckTree.get('id'), 'spath': node.get('path'), 'sid': node.get('id'), 'stype': node.get('type')});
    }
    //get the node in immutable tree given its immutable selector
    getImmNodeFromImmSelector(nodeIndex) {
        let chain = this.deckTree;
        nodeIndex.forEach((item, index) => {
            chain = chain.get(item);
        });
        return chain;
    }
    //get the node in immutable tree given the spath string
    getImmNodeFromPathString(path) {
        let nodeIndex = this.makeImmSelectorFromPath(path);
        return this.getImmNodeFromImmSelector(nodeIndex);
    }
    findParentNodeSelector(spath) {
        let arr = spath.split(';');
        //root deck is parent
        if(arr.length <= 1){
            return Immutable.fromJS({'id': this.deckTree.get('id'), 'spath': this.deckTree.get('path'), 'sid': this.deckTree.get('id'), 'stype': 'deck'});
        }else{
            arr.splice(-1,1);
            let parentPath = arr.join(';');
            let parentPart = arr[arr.length-1];
            return Immutable.fromJS({'id': this.deckTree.get('id'), 'spath': parentPath, 'sid': parentPart.split(':')[0], 'stype': 'deck'});
        }
    }
    //extracts the position from path string
    getRelPositionFromPath(spath) {
        let arr = spath.split(';');
        if(!arr.length){
            return 1;
        }else{
            return arr[arr.length - 1].split(':')[1];
        }
    }
    selectTreeNode(args) {
        let oldSelector = this.selector;
        this.selector = Immutable.fromJS({'id': args.id, 'spath': args.spath, 'sid': args.sid, 'stype': args.stype});
        this.switchSelector(oldSelector, this.selector);
        this.emitChange();
    }
    toggleTreeNode(selector) {
        let selectorIm = Immutable.fromJS(selector);
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //select new one
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('expanded', (val) => ! val));
        //update next and prev nodes states
        this.updatePrevNextSelectors();
        this.emitChange();
    }
    switchOnActionTreeNode(selector) {
        let selectorIm = Immutable.fromJS(selector);
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //select new one
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('onAction', (val) => ! val));
        this.emitChange();
    }
    updateTreeNode(payload) {
        let selectorIm = Immutable.fromJS(payload.selector);
        //set a default path in case of no path
        if(!payload.selector.spath){
            selectorIm = selectorIm.setIn(['spath'], this.generateASelectorPath(this.flatTree, selectorIm));
        }
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //update the node
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('title', (val) => payload.nodeSpec.title));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('id', (val) => payload.nodeSpec.id));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('path', (val) => payload.nodeSpec.path));
        //update flat tree for slide control
        this.flatTree = Immutable.fromJS(this.flattenTree(this.deckTree));
        this.emitChange();
    }
    renameTreeNode(selector) {
        let selectorIm = Immutable.fromJS(selector);
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //select new one
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('editable', (val) => true));
        this.emitChange();
    }
    //switch edtiable to false
    undoRenameTreeNode(selector) {
        let selectorIm = Immutable.fromJS(selector);
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //select new one
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('editable', (val) => false));
        this.emitChange();
    }
    saveTreeNode(payload) {
        let selectorIm = Immutable.fromJS(payload.selector);
        //set a default path in case of no path
        if(!payload.selector.spath){
            selectorIm = selectorIm.setIn(['spath'], this.generateASelectorPath(this.flatTree, selectorIm));
        }
        let selectedNodeIndex = this.makeImmSelectorFromPath(selectorIm.get('spath'));
        //select new one
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('editable', (val) => false));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('onAction', (val) => false));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('title', (val) => payload.newValue));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('id', (val) => payload.newSid));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('path', (val) => payload.newPath));
        this.emitChange();
    }
    //updates the nodes in the same level of selector which come after the selected node
    updateSiblingNodes(selectedNodeIndex, changePosition) {
        let list = this.deckTree;
        selectedNodeIndex.forEach((item, index) => {
            //chain will be a list of all nodes in the same level
            list = list.get(item);
        });
        list.forEach((item, index) => {
            if(index >= changePosition){
                let newPath = this.updateNodeRelPosition(item.get('path'), index+1);
                this.deckTree = this.deckTree.updateIn(selectedNodeIndex.concat(index), (node) => node.update('path', (val) => newPath));
                if(item.get('type') === 'deck'){
                    this.deckTree = this.deckTree.setIn(selectedNodeIndex.concat(index), this.updatePathForImmTree(item, this.makePathArrFromString(newPath)));
                }
            }
        });
    }
    //deselects the old node and selects the new node
    switchSelector(oldSelector, newSelector){
        let selectedNodeIndex = this.makeImmSelectorFromPath(oldSelector.get('spath'));
        try {
            this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('selected', (val) => false));
            this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('onAction', (val) => false));
            //should revert title changes after switch
            this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('editable', (val) => false));
        } catch (e) {
            //there might be the case when the node for old selector does not exist anymore
        }
        selectedNodeIndex = this.makeImmSelectorFromPath(newSelector.get('spath'));
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('selected', (val) => true));
        this.selector = newSelector;
        this.updatePrevNextSelectors();
    }
    deleteTreeNode(selector, silent) {
        let selectorIm = Immutable.fromJS(selector);
        //should first update the selected node to the change target
        if(!Immutable.is(this.selector, selectorIm)){
            this.deckTree = this.deckTree.updateIn(this.makeImmSelectorFromPath(this.selector.get('spath')),(node) => node.update('selected', (val) => false));
            this.selector = selectorIm;
        }
        //get relative position of node (starting in 0 index)
        let selectedRelPosition = this.getRelPositionFromPath(this.selector.get('spath')) - 1;
        //making the selector for the node in immutable tree
        let selectedNodeIndex = this.makeImmSelectorFromPath(this.selector.get('spath'));
        //delete node from the tree
        //do not allow delete if it is the only children
        let lastItem = selectedNodeIndex.splice(-1,1);
        let chain = this.deckTree;
        selectedNodeIndex.forEach((item, index) => {
            //chain will be a list of all nodes in the same level
            chain = chain.get(item);
        });
        //push back last item
        selectedNodeIndex.push(lastItem[0]);
        this.deckTree = this.deckTree.deleteIn(selectedNodeIndex);
        selectedNodeIndex.splice(-1,1);
        //should also update the path of all nodes which are in the same level
        //update the sibling nodes after deleting the node
        this.updateSiblingNodes(selectedNodeIndex, selectedRelPosition);
        //need to update flat tree for node absolute positions
        this.flatTree = Immutable.fromJS(this.flattenTree(this.deckTree));

        //should update the selector
        let newSelector;
        if (chain.size <= 1){
            //if deleting the only child of a deck, set to parent node
            newSelector = this.findParentNodeSelector(this.selector.get('spath'));
        } else {
            //select the node after the deleted one, or the node before, if it was the last one
            if (selectedRelPosition === chain.size - 1) {
                selectedRelPosition--;
            }
            selectedNodeIndex.push(selectedRelPosition);
            newSelector = this.makeSelectorFromNode(this.getImmNodeFromImmSelector(selectedNodeIndex));
        }

        // update the selector
        this.switchSelector(this.selector, newSelector);

        if (silent !== true){
            this.emitChange();
        }
    }
    addTreeNode(payload) {
        let newNode = Immutable.fromJS(payload.node);
        let selectorIm = Immutable.fromJS(payload.selector);
        let targetIndex = payload.targetIndex;
        //should first update the selected node to the change target
        if(!Immutable.is(this.selector, selectorIm)){
            this.deckTree = this.deckTree.updateIn(this.makeImmSelectorFromPath(this.selector.get('spath')),(node) => node.update('selected', (val) => false));
            this.selector = selectorIm;
        }

        let selectedRelPosition = this.getRelPositionFromPath(this.selector.get('spath')) - 1;
        let selectedNodeIndex = this.makeImmSelectorFromPath(this.selector.get('spath'));
        let chain = this.deckTree;

        let newNodePathString = '';
        //for decks, we should append it in the last child position if payload does not contain a targetIndex
        if(this.selector.get('stype')==='deck'){
            selectedNodeIndex.forEach((item, index) => {
                //chain will be a list of all nodes in the same level
                chain = chain.get(item);
            });
            if (targetIndex == null){
                targetIndex = chain.get('children').size;
            }
            if(chain.get('path')){
                newNodePathString = chain.get('path') + ';' + newNode.get('id') + ':' + (targetIndex + 1);
            }else{
                //for the first level node we don't need the ;
                newNodePathString = newNode.get('id') + ':' + (targetIndex + 1);
            }
        }else{
            //for slides, we should append it next to slide
            //insert new node to tree
            selectedNodeIndex.splice(-1,1);
            selectedNodeIndex.splice(-1,1);

            selectedNodeIndex.forEach((item, index) => {
                //chain will be a list of all nodes in the same level
                chain = chain.get(item);
            });
            if(chain.get('path')){
                newNodePathString = chain.get('path') + ';' + newNode.get('id') + ':' + (selectedRelPosition + 2);
            }else{
                //for the first level node we don't need the ;
                newNodePathString = newNode.get('id') + ':' + (selectedRelPosition + 2);
            }
        }
        //we need to update path for new node
        if(newNode.get('type') === 'slide'){
            newNode = newNode.set('path', newNodePathString);
            newNode = newNode.set('selected', true);
            //for now do not set the tree node added as editable, since handling revisioning changes of parent decks is now done with deck tree refetching
            //newNode = newNode.set('editable', true);
        }else{
            newNode = newNode.set('selected', true);
            newNode = newNode.set('expanded', true);
            //newNode = newNode.set('editable', true);
            newNode = this.updatePathForImmTree(newNode, this.makePathArrFromString(newNodePathString));
        }
        //add node to the child list
        chain = chain.get('children');
        //add node to the child list
        if(this.selector.get('stype')==='slide'){
            chain = chain.insert(selectedRelPosition + 1, newNode);
        }else{
            chain = chain.insert(targetIndex, newNode);
        }

        //update tree
        this.deckTree = this.deckTree.updateIn(selectedNodeIndex,(node) => node.update('children', (list) => chain) );
        //set back to child list
        selectedNodeIndex.push('children');
        //update siblings
        if(this.selector.get('stype')==='slide'){
            //update the sibling nodes after adding the node
            this.updateSiblingNodes(selectedNodeIndex, selectedRelPosition + 1);
        } else {
            this.updateSiblingNodes(selectedNodeIndex, targetIndex);
        }
        //need to update flat tree for node absolute positions
        this.flatTree = Immutable.fromJS(this.flattenTree(this.deckTree));
        //deselect the selected node in tree
        //should update the selector: set to the new node
        if(this.selector.get('stype')==='slide'){
            this.switchSelector(this.selector, this.makeSelectorFromNode(chain.get(selectedRelPosition + 1)));
        }else{
            this.switchSelector(this.selector, this.makeSelectorFromNode(chain.get(targetIndex)));
        }

        if (!payload.silent){
            this.emitChange();
        }
    }
    addTreeNodeList(payload){
        let nodePayload;
        let nodeSelector;
        let nodeTreePosition;

        // the first point to attach is the provided as selector
        nodeSelector=payload.selector;


        if(Array.isArray(payload.node)){ //more than node in the service answer
            for(let i=0;i<payload.node.length;i++){
                nodePayload = {
                    node:payload.node[i],
                    selector:nodeSelector
                };
                this.addTreeNode(nodePayload);
                //update next point to attach: addTreeNode updates it in this.selector
                nodeSelector={
                    id:this.selector.get('id'),
                    sid:this.selector.get('sid'),
                    spath:this.selector.get('spath'),
                    stype:this.selector.get('stype'),
                };

            }
        } else{ //only one slide or deck was selected.
            this.addTreeNode(payload);
        }
      //  this.updateTreeNode(payload);

    }
    updateNodeRelPosition(path, newPosition) {
        let arr = path.split(';');
        let lastNode = arr[arr.length - 1];
        arr.splice(-1,1);
        arr.push(lastNode.split(':')[0] + ':' + newPosition);
        return arr.join(';');
    }
    getSelector(){
        return {
            id: this.selector.get('id'),
            sid: this.selector.get('sid'),
            stype: this.selector.get('stype'),
            spath: this.selector.get('spath')
        };
    }
    getState() {
        return {
            deckTree: this.deckTree,
            selector: this.selector,
            flatTree: this.flatTree,
            prevSelector: this.prevSelector,
            nextSelector: this.nextSelector,
            error: this.error,
            isSelectorValid: this.isSelectorValid,
            revisionId: this.revisionId,
            latestRevisionId: this.latestRevisionId
        };
    }
    dehydrate() {
        return this.getState();
    }
    rehydrate(state) {
        this.deckTree = Immutable.fromJS(state.deckTree);
        this.selector = Immutable.fromJS(state.selector);
        this.flatTree = Immutable.fromJS(state.flatTree);
        this.prevSelector = Immutable.fromJS(state.prevSelector);
        this.nextSelector = Immutable.fromJS(state.nextSelector);
        this.error  = state.error;
        this.isSelectorValid = state.isSelectorValid;
        this.revisionId = state.revisionId;
        this.latestRevisionId = state.latestRevisionId;
    }
    handleDeckTreeError(err){
        this.error = err;
        this.emitChange();
    }
    moveTreeNode(payload){
        let {sourceNode, targetNode, targetIndex, selector} = payload;
        let currentIndex = this.getRelPositionFromPath(sourceNode.get('path')) - 1;
        let targetNodeSelector = this.makeSelectorFromNode(targetNode);

        //if reordering within same deck to a position after the initial one
        //adjust target index to point to correct position after deleteTreeNode
        if (targetNode.get('children').includes(sourceNode) && targetIndex > currentIndex){
            targetIndex--;
        } else {
            //we need to check if an ancestor of the target node is sibling of and comes after the source node
            //and adjust the corresponding index in the spath of the target node selector
            let sourceArr = sourceNode.get('path').split(';');
            let targetArr = targetNode.get('path').split(';');
            if (targetArr.length >= sourceArr.length){
                let hasCommonAncestor = true;
                let i = sourceArr.length - 2;
                while (hasCommonAncestor && i >= 0){
                    if (sourceArr[i] !== targetArr[i]){
                        hasCommonAncestor = false;
                    }
                    i--;
                }
                let targetAnc = targetArr[sourceArr.length - 1].split(':');
                if (hasCommonAncestor && (targetAnc[1] - 1) > currentIndex) {
                    targetAnc[1]--;
                    targetArr[sourceArr.length - 1] = targetAnc.join(':');
                    targetNodeSelector = targetNodeSelector.set('spath', targetArr.join(';'));
                }
            }
        }
        this.deleteTreeNode(this.makeSelectorFromNode(sourceNode), true);
        this.addTreeNode({node: sourceNode, selector: targetNodeSelector, targetIndex: targetIndex, silent: true});
        //by default we change the selected node to the moved one(done in addTreeNode) except for when
        //root node was selected when reorder was initiated
        if (!selector.spath){
            this.switchSelector(this.selector, Immutable.fromJS(selector));
        //or if we are at the subdeck view and we move a node within *that* subdeck
        } else if (selector.spath === targetNodeSelector.get('spath') && targetNode.get('children').includes(sourceNode)) {
            this.switchSelector(this.selector, targetNodeSelector);
        }
        this.emitChange();
    }
}

DeckTreeStore.storeName = 'DeckTreeStore';
DeckTreeStore.handlers = {
    'LOAD_DECK_TREE_SUCCESS': 'updateDeckTree',
    'SELECT_TREE_NODE_SUCCESS': 'selectTreeNode',
    'TOGGLE_TREE_NODE_SUCCESS': 'toggleTreeNode',
    'RENAME_TREE_NODE_SUCCESS': 'renameTreeNode',
    'UNDO_RENAME_TREE_NODE_SUCCESS': 'undoRenameTreeNode',
    'SAVE_TREE_NODE_SUCCESS': 'saveTreeNode',
    'DELETE_TREE_NODE_SUCCESS': 'deleteTreeNode',
    'UPDATE_TREE_NODE_SUCCESS': 'updateTreeNode',
    'ADD_TREE_NODE_SUCCESS': 'addTreeNode',
    'ADD_TREE_NODELIST_SUCCESS': 'addTreeNodeList',
    'SWITCH_ON_ACTION_TREE_NODE_SUCCESS': 'switchOnActionTreeNode',
    'MOVE_TREE_NODE_SUCCESS': 'moveTreeNode',
    'LOAD_DECK_TREE_FAILURE': 'handleDeckTreeError'


};

export default DeckTreeStore;
