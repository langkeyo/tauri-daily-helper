declare module 'xlsx-populate' {
    interface Cell {
        value(): any
        value(value: any): Cell
    }

    interface Sheet {
        cell(reference: string): Cell
        range(range: string): Range
    }

    interface Range {
        value(): any[][]
        value(values: any[][]): Range
    }

    interface Workbook {
        sheet(index: number): Sheet
        sheet(name: string): Sheet
        outputAsync(): Promise<Blob>
    }

    function fromFileAsync(path: string): Promise<Workbook>
    function fromDataAsync(data: ArrayBuffer): Promise<Workbook>

    export default {
        fromFileAsync,
        fromDataAsync
    }
} 