import { Dialog as DialogPrimitive } from 'bits-ui';
import Content from './sheet-content.svelte';
import {
	DialogHeader as Header,
	DialogTitle as Title,
	DialogDescription as Description
} from '$lib/components/ui/dialog';

const Root = DialogPrimitive.Root;

export {
	Root,
	Content,
	Header,
	Title,
	Description,
	//
	Root as Sheet,
	Content as SheetContent,
	Header as SheetHeader,
	Title as SheetTitle,
	Description as SheetDescription
};
